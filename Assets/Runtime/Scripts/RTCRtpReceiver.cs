using Newtonsoft.Json;
using System;
using System.Runtime.InteropServices;

namespace Unity.WebRTC
{
    /// <summary>
    /// 
    /// </summary>
    public class RTCRtpReceiver : IDisposable
    {
        internal IntPtr self;
        private RTCPeerConnection peer;
        private bool disposed;

        internal RTCRtpReceiver(IntPtr ptr, RTCPeerConnection peer)
        {
            self = ptr;
            WebRTC.Table.Add(self, this);
            this.peer = peer;
        }

        ~RTCRtpReceiver()
        {
            this.Dispose();
        }

        public virtual void Dispose()
        {
            if (this.disposed)
            {
                return;
            }
            if (self != IntPtr.Zero && !WebRTC.Context.IsNull)
            {
#if UNITY_WEBGL
                NativeMethods.DeleteReceiver(self);
#endif
                WebRTC.Table.Remove(self);
                self = IntPtr.Zero;
            }
            this.disposed = true;
            GC.SuppressFinalize(this);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="kind"></param>
        /// <returns></returns>
        public static RTCRtpCapabilities GetCapabilities(TrackKind kind)
        {
            WebRTC.Context.GetReceiverCapabilities(kind, out IntPtr ptr);
#if !UNITY_WEBGL
            RTCRtpCapabilitiesInternal capabilitiesInternal =
                Marshal.PtrToStructure<RTCRtpCapabilitiesInternal>(ptr);
            RTCRtpCapabilities capabilities = new RTCRtpCapabilities(capabilitiesInternal);
            Marshal.FreeHGlobal(ptr);
#else
            var capabilitiesJson = ptr.AsAnsiStringWithFreeMem();
            var capabilities = JsonConvert.DeserializeObject<RTCRtpCapabilities>(capabilitiesJson);
#endif
            return capabilities;
        }

        public RTCStatsReportAsyncOperation GetStats()
        {
            return peer.GetStats(this);
        }

        public MediaStreamTrack Track
        {
            get
            {
                IntPtr ptrTrack = NativeMethods.ReceiverGetTrack(self);
                return WebRTC.FindOrCreate(ptrTrack, MediaStreamTrack.Create);
            }
        }
    }
}
