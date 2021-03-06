using System;
using System.Linq;
using System.Collections.Generic;

namespace Unity.WebRTC
{
    public delegate void DelegateOnAddTrack(MediaStreamTrackEvent e);
    public delegate void DelegateOnRemoveTrack(MediaStreamTrackEvent e);

    public class MediaStream : IDisposable
    {
        private DelegateOnAddTrack onAddTrack;
        private DelegateOnRemoveTrack onRemoveTrack;

        private IntPtr self;
        private bool disposed;

        /// <summary>
        /// 
        /// </summary>
        public string Id =>
            NativeMethods.MediaStreamGetID(GetSelfOrThrow()).AsAnsiStringWithFreeMem();

        ~MediaStream()
        {
            this.Dispose();
        }

        public void Dispose()
        {
            if (this.disposed)
            {
                return;
            }
            if(self != IntPtr.Zero && !WebRTC.Context.IsNull)
            {
                WebRTC.Context.DeleteMediaStream(this);
                WebRTC.Table.Remove(self);
                self = IntPtr.Zero;
            }
            this.disposed = true;
            GC.SuppressFinalize(this);
        }

        public DelegateOnAddTrack OnAddTrack
        {
            get => onAddTrack;
            set
            {
                onAddTrack = value;
            }
        }

        public DelegateOnRemoveTrack OnRemoveTrack
        {
            get => onRemoveTrack;
            set
            {
                onRemoveTrack = value;
            }
        }

        private void StopTrack(MediaStreamTrack track)
        {

            if (track.Kind == TrackKind.Video)
            {
                WebRTC.Context.StopMediaStreamTrack(track.GetSelfOrThrow());
            }
            else
            {
                Audio.Stop();
            }
        }

        public IEnumerable<VideoStreamTrack> GetVideoTracks()
        {
#if !UNITY_WEBGL
            var buf = NativeMethods.MediaStreamGetVideoTracks(GetSelfOrThrow(), out ulong length);
            return WebRTC.Deserialize(buf, (int)length, ptr => new VideoStreamTrack(ptr));
#else
            var ptr = NativeMethods.MediaStreamGetVideoTracks(GetSelfOrThrow());
            var buf = NativeMethods.ptrToIntPtrArray(ptr);
            var videoTracks = buf.Select(p => new VideoStreamTrack(p));
            return videoTracks;
#endif
        }

        public IEnumerable<AudioStreamTrack> GetAudioTracks()
        {
#if !UNITY_WEBGL
            var buf = NativeMethods.MediaStreamGetAudioTracks(GetSelfOrThrow(), out ulong length);
            return WebRTC.Deserialize(buf, (int)length, ptr => new AudioStreamTrack(ptr));
#else
            var ptr = NativeMethods.MediaStreamGetAudioTracks(GetSelfOrThrow());
            var buf = NativeMethods.ptrToIntPtrArray(ptr);
            var audioTracks = buf.Select(p => new AudioStreamTrack(p));
            return audioTracks;
#endif
        }

        public IEnumerable<MediaStreamTrack> GetTracks()
        {
            return GetAudioTracks().Cast<MediaStreamTrack>().Concat(GetVideoTracks());
        }

        public bool AddTrack(MediaStreamTrack track)
        {
            return NativeMethods.MediaStreamAddTrack(GetSelfOrThrow(), track.GetSelfOrThrow());
        }
        public bool RemoveTrack(MediaStreamTrack track)
        {
            return NativeMethods.MediaStreamRemoveTrack(GetSelfOrThrow(), track.GetSelfOrThrow());
        }

#if !UNITY_WEBGL
        public MediaStream() : this(WebRTC.Context.CreateMediaStream(Guid.NewGuid().ToString()))
        {
        }
#else
        public MediaStream() : this(WebRTC.Context.CreateMediaStream())
        {
        }
#endif

        internal IntPtr GetSelfOrThrow()
        {
            if (self == IntPtr.Zero)
            {
                throw new InvalidOperationException("This instance has been disposed.");
            }
            return self;
        }

        internal MediaStream(IntPtr ptr)
        {
            self = ptr;
            WebRTC.Table.Add(self, this);
            WebRTC.Context.MediaStreamRegisterOnAddTrack(self, MediaStreamOnAddTrack);
            WebRTC.Context.MediaStreamRegisterOnRemoveTrack(self, MediaStreamOnRemoveTrack);
        }

        [AOT.MonoPInvokeCallback(typeof(DelegateNativeMediaStreamOnAddTrack))]
        static void MediaStreamOnAddTrack(IntPtr ptr, IntPtr track)
        {
#if !UNITY_WEBGL
            WebRTC.Sync(ptr, () =>
            {
                if (WebRTC.Table[ptr] is MediaStream stream)
                {
                    stream.onAddTrack?.Invoke(new MediaStreamTrackEvent(track));
                }
            });
#else
            if (WebRTC.Table[ptr] is MediaStream stream)
            {
                stream.onAddTrack?.Invoke(new MediaStreamTrackEvent(track));
            }
#endif
        }

        [AOT.MonoPInvokeCallback(typeof(DelegateNativeMediaStreamOnRemoveTrack))]
        static void MediaStreamOnRemoveTrack(IntPtr ptr, IntPtr track)
        {
#if !UNITY_WEBGL
            WebRTC.Sync(ptr, () =>
            {
                if (WebRTC.Table[ptr] is MediaStream stream)
                {
                    stream.onRemoveTrack?.Invoke(new MediaStreamTrackEvent(track));
                }
            });
#else
            if (WebRTC.Table[ptr] is MediaStream stream)
            {
                stream.onRemoveTrack?.Invoke(new MediaStreamTrackEvent(track));
            }
#endif
        }
    }
}
