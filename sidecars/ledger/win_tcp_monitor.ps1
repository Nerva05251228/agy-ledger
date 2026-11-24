param(
  [int]$ParentPid = 0,
  [int]$PollMs = 1500
)

$ErrorActionPreference = 'Stop'

$cs = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32;

public static class AgyTcpMonitor {
    const int AF_INET = 2;
    const int AF_INET6 = 23;
    const int TCP_TABLE_OWNER_PID_ALL = 5;
    const int TcpConnectionEstatsData = 1;

    static volatile bool _stopRequested = false;

    static readonly string[] ProxyTokens = new string[] {
        "mihomo", "clash", "sing-box", "sing_box", "v2ray", "xray",
        "hysteria", "tuic", "naive", "ss-local", "sslocal", "shadowsocks",
        "trojan", "privoxy", "polipo", "squid", "fiddler", "charles",
        "mitmproxy", "nekoray", "nekobox", "flclash", "sparkle", "surge",
        "karing", "qv2ray", "gost", "brook", "tailscaled", "warp",
        "proxifier", "loon", "stash", "daed", "juicity"
    };

    [StructLayout(LayoutKind.Sequential)]
    struct MIB_TCPROW_OWNER_PID {
        public uint state;
        public uint localAddr;
        public uint localPort;
        public uint remoteAddr;
        public uint remotePort;
        public uint owningPid;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MIB_TCPROW {
        public uint state;
        public uint localAddr;
        public uint localPort;
        public uint remoteAddr;
        public uint remotePort;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MIB_TCP6ROW_OWNER_PID {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] localAddr;
        public uint localScopeId;
        public uint localPort;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] remoteAddr;
        public uint remoteScopeId;
        public uint remotePort;
        public uint state;
        public uint owningPid;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MIB_TCP6ROW {
        public uint state;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] localAddr;
        public uint localScopeId;
        public uint localPort;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] remoteAddr;
        public uint remoteScopeId;
        public uint remotePort;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct TCP_ESTATS_DATA_RW_v0 {
        public byte EnableCollection;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct TCP_ESTATS_DATA_ROD_v0 {
        public ulong DataBytesOut;
        public ulong DataSegsOut;
        public ulong DataBytesIn;
        public ulong DataSegsIn;
        public ulong SegsOut;
        public ulong SegsIn;
        public uint SoftErrors;
        public uint SoftErrorReason;
        public uint SndUna;
        public uint SndNxt;
        public uint SndMax;
        public ulong ThruBytesAcked;
        public uint RcvNxt;
        public ulong ThruBytesReceived;
    }

    [DllImport("iphlpapi.dll", SetLastError = true)]
    static extern uint GetExtendedTcpTable(IntPtr pTcpTable, ref int dwOutBufLen, bool sort, int ipVersion, int tblClass, uint reserved);

    [DllImport("iphlpapi.dll")]
    static extern uint SetPerTcpConnectionEStats(ref MIB_TCPROW Row, int EstatsType, IntPtr Rw, uint RwVersion, uint RwSize, uint Offset);

    [DllImport("iphlpapi.dll")]
    static extern uint GetPerTcpConnectionEStats(ref MIB_TCPROW Row, int EstatsType, IntPtr Rw, uint RwVersion, uint RwSize, IntPtr Ros, uint RosVersion, uint RosSize, IntPtr Rod, uint RodVersion, uint RodSize);

    [DllImport("iphlpapi.dll")]
    static extern uint SetPerTcp6ConnectionEStats(ref MIB_TCP6ROW Row, int EstatsType, IntPtr Rw, uint RwVersion, uint RwSize, uint Offset);

    [DllImport("iphlpapi.dll")]
    static extern uint GetPerTcp6ConnectionEStats(ref MIB_TCP6ROW Row, int EstatsType, IntPtr Rw, uint RwVersion, uint RwSize, IntPtr Ros, uint RosVersion, uint RosSize, IntPtr Rod, uint RodVersion, uint RodSize);

    static ushort PortHost(uint p) {
        return (ushort)IPAddress.NetworkToHostOrder((short)(p & 0xFFFF));
    }

    static bool IsLoopbackV4(uint addr) {
        return (addr & 0xFF) == 127;
    }

    static bool IsUnspecifiedV4(uint addr) {
        return addr == 0;
    }

    static bool IsLoopbackV6(byte[] addr) {
        if (addr == null || addr.Length != 16) return false;
        for (int i = 0; i < 15; i++) if (addr[i] != 0) return false;
        return addr[15] == 1;
    }

    static bool IsUnspecifiedV6(byte[] addr) {
        if (addr == null || addr.Length != 16) return true;
        for (int i = 0; i < 16; i++) if (addr[i] != 0) return false;
        return true;
    }

    static bool IsAgyName(string raw) {
        if (string.IsNullOrEmpty(raw)) return false;
        string n = raw.ToLowerInvariant();
        return n == "antigravity" || n.StartsWith("antigravity-") || n.StartsWith("antigravity ")
            || n == "language_server" || n.StartsWith("language_server_") || n.StartsWith("language_server-")
            || n == "agy-cli";
    }

    static bool IsProxyName(string raw) {
        if (string.IsNullOrEmpty(raw)) return false;
        string n = raw.ToLowerInvariant();
        for (int i = 0; i < ProxyTokens.Length; i++) {
            if (n.Contains(ProxyTokens[i])) return true;
        }
        return false;
    }

    static bool IsActiveTcpState(uint state) {
        // ESTABLISHED(5), FIN_WAIT1(6), FIN_WAIT2(7), CLOSE_WAIT(8), CLOSING(9), LAST_ACK(10)
        return state >= 5 && state <= 10;
    }

    static List<MIB_TCPROW_OWNER_PID> GetTcp4Rows() {
        var list = new List<MIB_TCPROW_OWNER_PID>();
        int size = 0;
        GetExtendedTcpTable(IntPtr.Zero, ref size, false, AF_INET, TCP_TABLE_OWNER_PID_ALL, 0);
        if (size <= 0) return list;
        IntPtr buf = Marshal.AllocHGlobal(size);
        try {
            if (GetExtendedTcpTable(buf, ref size, false, AF_INET, TCP_TABLE_OWNER_PID_ALL, 0) == 0) {
                int count = Marshal.ReadInt32(buf);
                IntPtr ptr = IntPtr.Add(buf, 4);
                int rowSize = Marshal.SizeOf(typeof(MIB_TCPROW_OWNER_PID));
                for (int i = 0; i < count; i++) {
                    list.Add((MIB_TCPROW_OWNER_PID)Marshal.PtrToStructure(ptr, typeof(MIB_TCPROW_OWNER_PID)));
                    ptr = IntPtr.Add(ptr, rowSize);
                }
            }
        } finally {
            Marshal.FreeHGlobal(buf);
        }
        return list;
    }

    static List<MIB_TCP6ROW_OWNER_PID> GetTcp6Rows() {
        var list = new List<MIB_TCP6ROW_OWNER_PID>();
        int size = 0;
        GetExtendedTcpTable(IntPtr.Zero, ref size, false, AF_INET6, TCP_TABLE_OWNER_PID_ALL, 0);
        if (size <= 0) return list;
        IntPtr buf = Marshal.AllocHGlobal(size);
        try {
            if (GetExtendedTcpTable(buf, ref size, false, AF_INET6, TCP_TABLE_OWNER_PID_ALL, 0) == 0) {
                int count = Marshal.ReadInt32(buf);
                IntPtr ptr = IntPtr.Add(buf, 4);
                int rowSize = Marshal.SizeOf(typeof(MIB_TCP6ROW_OWNER_PID));
                for (int i = 0; i < count; i++) {
                    list.Add((MIB_TCP6ROW_OWNER_PID)Marshal.PtrToStructure(ptr, typeof(MIB_TCP6ROW_OWNER_PID)));
                    ptr = IntPtr.Add(ptr, rowSize);
                }
            }
        } finally {
            Marshal.FreeHGlobal(buf);
        }
        return list;
    }

    static HashSet<ushort> DetectSystemProxyPorts() {
        var ports = new HashSet<ushort>();
        try {
            using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Internet Settings")) {
                if (key != null) {
                    object en = key.GetValue("ProxyEnable");
                    object srv = key.GetValue("ProxyServer");
                    if (en != null && Convert.ToInt32(en) == 1 && srv != null) {
                        foreach (Match m in Regex.Matches(srv.ToString(), @":(\d{2,5})\b")) {
                            ushort p;
                            if (ushort.TryParse(m.Groups[1].Value, out p) && p > 0) ports.Add(p);
                        }
                    }
                }
            }
        } catch {}
        string[] envNames = new string[] { "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy" };
        foreach (var ev in envNames) {
            try {
                string val = Environment.GetEnvironmentVariable(ev);
                if (string.IsNullOrEmpty(val)) continue;
                foreach (Match m in Regex.Matches(val, @":(\d{2,5})\b")) {
                    ushort p;
                    if (ushort.TryParse(m.Groups[1].Value, out p) && p > 0) ports.Add(p);
                }
            } catch {}
        }
        return ports;
    }

    static bool IsParentAlive(int parentPid) {
        if (parentPid <= 0) return true;
        try {
            using (var p = Process.GetProcessById(parentPid)) {
                return !p.HasExited;
            }
        } catch {
            return false;
        }
    }

    public static void Run(int parentPid, int pollMs) {
        _stopRequested = false;
        var stdinThread = new Thread(() => {
            try {
                while (Console.In.ReadLine() != null) {}
            } catch {}
            _stopRequested = true;
        });
        stdinThread.IsBackground = true;
        stdinThread.Start();

        var prevByConn = new Dictionary<string, Tuple<ulong, ulong>>();
        var enabledConns = new HashSet<string>();
        var proxyPorts = DetectSystemProxyPorts();
        long lastProxyRefresh = Environment.TickCount;
        bool isFirstTick = true;
        int tickCount = 0;

        IntPtr rwPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(TCP_ESTATS_DATA_RW_v0)));
        IntPtr rodPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(TCP_ESTATS_DATA_ROD_v0)));
        Marshal.StructureToPtr(new TCP_ESTATS_DATA_RW_v0 { EnableCollection = 1 }, rwPtr, false);
        uint rwSize = (uint)Marshal.SizeOf(typeof(TCP_ESTATS_DATA_RW_v0));
        uint rodSize = (uint)Marshal.SizeOf(typeof(TCP_ESTATS_DATA_ROD_v0));

        try {
            while (!_stopRequested && IsParentAlive(parentPid)) {
                tickCount++;
                if (unchecked(Environment.TickCount - lastProxyRefresh) > 15000) {
                    proxyPorts = DetectSystemProxyPorts();
                    lastProxyRefresh = Environment.TickCount;
                }

                var agyPids = new HashSet<uint>();
                var proxyPids = new HashSet<uint>();
                foreach (var p in Process.GetProcesses()) {
                    try {
                        uint pid = (uint)p.Id;
                        string n = p.ProcessName;
                        if (IsAgyName(n)) agyPids.Add(pid);
                        else if (IsProxyName(n)) proxyPids.Add(pid);
                    } catch {} finally {
                        try { p.Dispose(); } catch {}
                    }
                }

                var rows4 = GetTcp4Rows();
                var rows6 = GetTcp6Rows();

                var listenOwners = new Dictionary<ushort, HashSet<uint>>();
                var externalPids = new HashSet<uint>();

                foreach (var r in rows4) {
                    if (r.state == 2) {
                        ushort lp = PortHost(r.localPort);
                        HashSet<uint> set;
                        if (!listenOwners.TryGetValue(lp, out set)) {
                            set = new HashSet<uint>();
                            listenOwners[lp] = set;
                        }
                        set.Add(r.owningPid);
                    } else if (IsActiveTcpState(r.state) && !IsLoopbackV4(r.remoteAddr) && !IsUnspecifiedV4(r.remoteAddr)) {
                        externalPids.Add(r.owningPid);
                    }
                }
                foreach (var r in rows6) {
                    if (r.state == 2) {
                        ushort lp = PortHost(r.localPort);
                        HashSet<uint> set;
                        if (!listenOwners.TryGetValue(lp, out set)) {
                            set = new HashSet<uint>();
                            listenOwners[lp] = set;
                        }
                        set.Add(r.owningPid);
                    } else if (IsActiveTcpState(r.state) && !IsLoopbackV6(r.remoteAddr) && !IsUnspecifiedV6(r.remoteAddr)) {
                        externalPids.Add(r.owningPid);
                    }
                }

                var seenKeys = new HashSet<string>();
                ulong upDelta = 0;
                ulong downDelta = 0;
                int activeConns = 0;
                int deniedCount = 0;
                int okCount = 0;

                Func<ushort, ushort, bool> shouldCountLoopback = (lp, rp) => {
                    HashSet<uint> localOwners;
                    if (listenOwners.TryGetValue(lp, out localOwners)) {
                        foreach (var op in localOwners) if (agyPids.Contains(op)) return false;
                    }
                    HashSet<uint> remoteOwners;
                    if (listenOwners.TryGetValue(rp, out remoteOwners)) {
                        foreach (var op in remoteOwners) if (agyPids.Contains(op)) return false;
                        if (proxyPorts.Contains(rp)) return true;
                        foreach (var op in remoteOwners) {
                            if (proxyPids.Contains(op) || externalPids.Contains(op)) return true;
                        }
                        return false;
                    }
                    return proxyPorts.Contains(rp);
                };

                // IPv4 connections
                foreach (var r in rows4) {
                    if (!IsActiveTcpState(r.state) || !agyPids.Contains(r.owningPid)) continue;
                    if (IsUnspecifiedV4(r.remoteAddr)) continue;
                    ushort lp = PortHost(r.localPort);
                    ushort rp = PortHost(r.remotePort);
                    if (rp == 0) continue;
                    if (IsLoopbackV4(r.remoteAddr) && !shouldCountLoopback(lp, rp)) continue;

                    string key = "4:" + r.owningPid + ":" + r.localAddr + ":" + lp + "->" + r.remoteAddr + ":" + rp;
                    seenKeys.Add(key);
                    activeConns++;

                    var row = new MIB_TCPROW {
                        state = r.state, localAddr = r.localAddr, localPort = r.localPort,
                        remoteAddr = r.remoteAddr, remotePort = r.remotePort
                    };
                    if (!enabledConns.Contains(key)) {
                        uint setErr = SetPerTcpConnectionEStats(ref row, TcpConnectionEstatsData, rwPtr, 0, rwSize, 0);
                        if (setErr == 0) enabledConns.Add(key);
                        else if (setErr == 5) deniedCount++;
                    }
                    uint getErr = GetPerTcpConnectionEStats(ref row, TcpConnectionEstatsData, IntPtr.Zero, 0, 0, IntPtr.Zero, 0, 0, rodPtr, 0, rodSize);
                    if (getErr == 0) {
                        okCount++;
                        var rod = (TCP_ESTATS_DATA_ROD_v0)Marshal.PtrToStructure(rodPtr, typeof(TCP_ESTATS_DATA_ROD_v0));
                        ulong curOut = rod.DataBytesOut;
                        ulong curIn = rod.DataBytesIn;
                        Tuple<ulong, ulong> prev;
                        if (prevByConn.TryGetValue(key, out prev)) {
                            ulong dOut = curOut >= prev.Item1 ? (curOut - prev.Item1) : curOut;
                            ulong dIn = curIn >= prev.Item2 ? (curIn - prev.Item2) : curIn;
                            if (dOut < 4294967296UL) upDelta += dOut;
                            if (dIn < 4294967296UL) downDelta += dIn;
                        } else if (!isFirstTick) {
                            if (curOut < 4294967296UL) upDelta += curOut;
                            if (curIn < 4294967296UL) downDelta += curIn;
                        }
                        prevByConn[key] = Tuple.Create(curOut, curIn);
                    } else if (getErr == 5) {
                        deniedCount++;
                    }
                }

                // IPv6 connections
                foreach (var r in rows6) {
                    if (!IsActiveTcpState(r.state) || !agyPids.Contains(r.owningPid)) continue;
                    if (IsUnspecifiedV6(r.remoteAddr)) continue;
                    ushort lp = PortHost(r.localPort);
                    ushort rp = PortHost(r.remotePort);
                    if (rp == 0) continue;
                    if (IsLoopbackV6(r.remoteAddr) && !shouldCountLoopback(lp, rp)) continue;

                    string key = "6:" + r.owningPid + ":" + Convert.ToBase64String(r.localAddr) + ":" + lp + "->" + Convert.ToBase64String(r.remoteAddr) + ":" + rp;
                    seenKeys.Add(key);
                    activeConns++;

                    var row = new MIB_TCP6ROW {
                        state = r.state, localAddr = r.localAddr, localScopeId = r.localScopeId, localPort = r.localPort,
                        remoteAddr = r.remoteAddr, remoteScopeId = r.remoteScopeId, remotePort = r.remotePort
                    };
                    if (!enabledConns.Contains(key)) {
                        uint setErr = SetPerTcp6ConnectionEStats(ref row, TcpConnectionEstatsData, rwPtr, 0, rwSize, 0);
                        if (setErr == 0) enabledConns.Add(key);
                        else if (setErr == 5) deniedCount++;
                    }
                    uint getErr = GetPerTcp6ConnectionEStats(ref row, TcpConnectionEstatsData, IntPtr.Zero, 0, 0, IntPtr.Zero, 0, 0, rodPtr, 0, rodSize);
                    if (getErr == 0) {
                        okCount++;
                        var rod = (TCP_ESTATS_DATA_ROD_v0)Marshal.PtrToStructure(rodPtr, typeof(TCP_ESTATS_DATA_ROD_v0));
                        ulong curOut = rod.DataBytesOut;
                        ulong curIn = rod.DataBytesIn;
                        Tuple<ulong, ulong> prev;
                        if (prevByConn.TryGetValue(key, out prev)) {
                            ulong dOut = curOut >= prev.Item1 ? (curOut - prev.Item1) : curOut;
                            ulong dIn = curIn >= prev.Item2 ? (curIn - prev.Item2) : curIn;
                            if (dOut < 4294967296UL) upDelta += dOut;
                            if (dIn < 4294967296UL) downDelta += dIn;
                        } else if (!isFirstTick) {
                            if (curOut < 4294967296UL) upDelta += curOut;
                            if (curIn < 4294967296UL) downDelta += curIn;
                        }
                        prevByConn[key] = Tuple.Create(curOut, curIn);
                    } else if (getErr == 5) {
                        deniedCount++;
                    }
                }

                // Prune closed connections
                var stale = new List<string>();
                foreach (var k in prevByConn.Keys) {
                    if (!seenKeys.Contains(k)) stale.Add(k);
                }
                foreach (var k in stale) {
                    prevByConn.Remove(k);
                    enabledConns.Remove(k);
                }

                string status = (deniedCount > 0 && okCount == 0) ? "admin_required" : "active";
                if (isFirstTick || upDelta > 0 || downDelta > 0 || (tickCount % 6 == 0)) {
                    Console.WriteLine(
                        "{\"status\":\"" + status + "\",\"upDelta\":" + upDelta +
                        ",\"downDelta\":" + downDelta + ",\"activeConns\":" + activeConns +
                        ",\"pidCount\":" + agyPids.Count + "}"
                    );
                    Console.Out.Flush();
                }

                isFirstTick = false;
                Thread.Sleep(pollMs);
            }
        } finally {
            Marshal.FreeHGlobal(rwPtr);
            Marshal.FreeHGlobal(rodPtr);
        }
    }
}
'@

Add-Type -TypeDefinition $cs -ErrorAction Stop
[AgyTcpMonitor]::Run($ParentPid, $PollMs)
