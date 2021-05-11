using System;
using System.Collections.Generic;
using System.ComponentModel;
using UnityEngine;
using UnityEngine.Experimental.Rendering;

namespace Unity.WebRTC
{
    public class VideoStreamTrack : MediaStreamTrack
    {
        internal static List<VideoStreamTrack> tracks = new List<VideoStreamTrack>();

        bool m_needFlip = false;
        UnityEngine.Texture m_sourceTexture;
#if !UNITY_WEBGL
        UnityEngine.RenderTexture m_destTexture;
#else
        Texture m_destTexture;
#endif

#if !UNITY_WEBGL
        UnityVideoRenderer m_renderer;
#else
        public bool IsRemote { get; private set; }
#endif

        private static RenderTexture CreateRenderTexture(int width, int height,
            RenderTextureFormat format)
        {
            // todo::(kazuki) Increase the supported formats.
            RenderTextureFormat supportedFormat
                = WebRTC.GetSupportedRenderTextureFormat(UnityEngine.SystemInfo.graphicsDeviceType);
            if (format != supportedFormat)
            {
                throw new ArgumentException(
                    $"This graphics format is not supported for streaming: {format} supportedFormat: {supportedFormat}");
            }

            var tex = new RenderTexture(width, height, 0, format);
            tex.Create();
            return tex;
        }

#if !UNITY_WEBGL
        internal VideoStreamTrack(string label, UnityEngine.Texture source, UnityEngine.RenderTexture dest, int width,
            int height)
            : this(label, dest.GetNativeTexturePtr(), width, height, source.graphicsFormat)
        {
            m_needFlip = true;
            m_sourceTexture = source;
            m_destTexture = dest;
        }
#else
        internal VideoStreamTrack(string label, UnityEngine.Texture source, UnityEngine.RenderTexture dest, int width,
            int height)
            : this(source.GetNativeTexturePtr(), dest.GetNativeTexturePtr(), width, height)
        {
            m_needFlip = true;
            m_sourceTexture = source;
            m_destTexture = dest;
        }
#endif

        /// <summary>
        /// note:
        /// The videotrack cannot be used if the encoder has not been initialized.
        /// Do not use it until the initialization is complete.
        /// </summary>
        public bool IsEncoderInitialized
        {
            get
            {
#if !UNITY_WEBGL
                return WebRTC.Context.GetInitializationResult(GetSelfOrThrow()) == CodecInitializationResult.Success;
#else
                return !IsRemote;
#endif
            }
        }

        public bool IsDecoderInitialized
        {
            get
            {
#if !UNITY_WEBGL
                return m_renderer != null && m_renderer.self != IntPtr.Zero;
#else
                return IsRemote;
#endif
            }
        }

        public UnityEngine.Texture InitializeReceiver(int width, int height)
        {
#if !UNITY_WEBGL
            if (IsDecoderInitialized)
                throw new InvalidOperationException("Already initialized receiver");
#endif

            m_needFlip = true;
            var format = WebRTC.GetSupportedGraphicsFormat(SystemInfo.graphicsDeviceType);
            var renderTextureFormat = WebRTC.GetSupportedRenderTextureFormat(SystemInfo.graphicsDeviceType);
#if !UNITY_WEBGL
            m_sourceTexture = new Texture2D(width, height, format, TextureCreationFlags.None);
            m_destTexture = CreateRenderTexture(m_sourceTexture.width, m_sourceTexture.height, renderTextureFormat);
            m_renderer = new UnityVideoRenderer(WebRTC.Context.CreateVideoRenderer(), this);
#else
            Debug.Log("InitializeReceiver");
            //m_destTexture = CreateRenderTexture(width, height, renderTextureFormat);
            var texPtr = NativeMethods.CreateNativeTexture();
            var tex = Texture2D.CreateExternalTexture(width, height, TextureFormat.RGBA32, false, false, texPtr);
            tex.UpdateExternalTexture(texPtr);
            m_destTexture = tex;
            IsRemote = true;
            Debug.Log($"IsRemote:{IsRemote}");
#endif


            return m_destTexture;
        }

        internal void UpdateReceiveTexture()
        {
#if !UNITY_WEBGL
            // [Note-kazuki: 2020-03-09] Flip vertically RenderTexture
            // note: streamed video is flipped vertical if no action was taken:
            //  - duplicate RenderTexture from its source texture
            //  - call Graphics.Blit command with flip material every frame
            //  - it might be better to implement this if possible
            if (m_needFlip)
            {
                UnityEngine.Graphics.Blit(m_sourceTexture, m_destTexture, WebRTC.flipMat);
            }

            WebRTC.Context.UpdateRendererTexture(m_renderer.id, m_sourceTexture);
#else
            NativeMethods.UpdateRendererTexture(self, m_destTexture.GetNativeTexturePtr(), m_needFlip);
#endif
        }

        internal void Update()
        {
#if !UNITY_WEBGL
            // [Note-kazuki: 2020-03-09] Flip vertically RenderTexture
            // note: streamed video is flipped vertical if no action was taken:
            //  - duplicate RenderTexture from its source texture
            //  - call Graphics.Blit command with flip material every frame
            //  - it might be better to implement this if possible
            if (m_needFlip)
            {
                UnityEngine.Graphics.Blit(m_sourceTexture, m_destTexture, WebRTC.flipMat);
            }

            WebRTC.Context.Encode(self);
#else
            NativeMethods.RenderLocalVideotrack(self);
#endif
        }

        /// <summary>
        /// Creates a new VideoStream object.
        /// The track is created with a `source`.
        /// </summary>
        /// <param name="label"></param>
        /// <param name="source"></param>
        /// <param name="width"></param>
        /// <param name="height"></param>
        public VideoStreamTrack(string label, UnityEngine.RenderTexture source)
            : this(label, source, CreateRenderTexture(source.width, source.height, source.format), source.width,
                source.height)
        {
        }

        public VideoStreamTrack(string label, UnityEngine.Texture source)
            : this(label,
                source,
                CreateRenderTexture(source.width, source.height,
                    WebRTC.GetSupportedRenderTextureFormat(UnityEngine.SystemInfo.graphicsDeviceType)),
                source.width,
                source.height)
        {
        }


#if !UNITY_WEBGL
        /// <summary>
        /// Creates a new VideoStream object.
        /// The track is created with a source texture `ptr`.
        /// It is noted that streamed video might be flipped when not action was taken. Almost case it has no problem to use other constructor instead.
        ///
        /// See Also: Texture.GetNativeTexturePtr
        /// </summary>
        /// <param name="label"></param>
        /// <param name="texturePtr"></param>
        /// <param name="width"></param>
        /// <param name="height"></param>
        /// <param name="format"></param>
        public VideoStreamTrack(string label, IntPtr texturePtr, int width, int height, GraphicsFormat format)
            : base(WebRTC.Context.CreateVideoTrack(label))
        {
            WebRTC.Context.SetVideoEncoderParameter(self, width, height, format, texturePtr);
            WebRTC.Context.InitializeEncoder(self);
            tracks.Add(this);
        }
#else
        /// <summary>
        /// Creates a new VideoStream object.
        /// The track is created with a source texture `ptr`.
        /// It is noted that streamed video might be flipped when not action was taken. Almost case it has no problem to use other constructor instead.
        ///
        /// See Also: Texture.GetNativeTexturePtr
        /// </summary>
        /// <param name="srcTexturePtr"></param>
        /// <param name="dstTexturePtr"></param>
        /// <param name="width"></param>
        /// <param name="height"></param>
        public VideoStreamTrack(IntPtr srcTexturePtr, IntPtr dstTexturePtr, int width, int height)
            : base(WebRTC.Context.CreateVideoTrack(srcTexturePtr, dstTexturePtr, width, height))
        {
            tracks.Add(this);
        }
#endif
        /// <summary>
        /// Creates from MediaStreamTrack object
        /// </summary>
        /// <param name="sourceTrack"></param>
        internal VideoStreamTrack(IntPtr sourceTrack) : base(sourceTrack)
        {
            tracks.Add(this);
        }

        public override void Dispose()
        {
            if (this.disposed)
            {
                return;
            }

            if (self != IntPtr.Zero && !WebRTC.Context.IsNull)
            {
#if !UNITY_WEBGL
                if (IsEncoderInitialized)
                {
                    WebRTC.Context.FinalizeEncoder(self);
                    if (RenderTexture.active == m_destTexture)
                            RenderTexture.active = null;
                    UnityEngine.Object.DestroyImmediate(m_destTexture);
                }
#else
                if (RenderTexture.active == m_destTexture)
                    RenderTexture.active = null;
                UnityEngine.Object.DestroyImmediate(m_destTexture);
#endif

#if !UNITY_WEBGL
                if (IsDecoderInitialized)
                {
                    m_renderer.Dispose();
                    UnityEngine.Object.DestroyImmediate(m_sourceTexture);
                }
#endif

                tracks.Remove(this);
                WebRTC.Context.DeleteMediaStreamTrack(self);
                WebRTC.Table.Remove(self);
                self = IntPtr.Zero;
            }

            this.disposed = true;
            GC.SuppressFinalize(this);
        }
    }

    public static class CameraExtension
    {
        public static VideoStreamTrack CaptureStreamTrack(this UnityEngine.Camera cam, int width, int height, int bitrate,
            RenderTextureDepth depth = RenderTextureDepth.DEPTH_24)
        {
            switch (depth)
            {
                case RenderTextureDepth.DEPTH_16:
                case RenderTextureDepth.DEPTH_24:
                case RenderTextureDepth.DEPTH_32:
                    break;
                default:
                    throw new InvalidEnumArgumentException(nameof(depth), (int)depth, typeof(RenderTextureDepth));
            }

            int depthValue = (int)depth;
            var format = WebRTC.GetSupportedRenderTextureFormat(UnityEngine.SystemInfo.graphicsDeviceType);
            var rt = new UnityEngine.RenderTexture(width, height, depthValue, format);
            rt.Create();
            cam.targetTexture = rt;
            return new VideoStreamTrack(cam.name, rt);
        }


        public static MediaStream CaptureStream(this UnityEngine.Camera cam, int width, int height, int bitrate,
            RenderTextureDepth depth = RenderTextureDepth.DEPTH_24)
        {
#if !UNITY_WEBGL
            var stream = new MediaStream(WebRTC.Context.CreateMediaStream("videostream"));
#else
            var stream = new MediaStream(WebRTC.Context.CreateMediaStream());
#endif
            var track = cam.CaptureStreamTrack(width, height, bitrate, depth);
            stream.AddTrack(track);
            return stream;
        }
    }

    internal class UnityVideoRenderer : IDisposable
    {
        internal IntPtr self;
        private VideoStreamTrack track;
        internal uint id => NativeMethods.GetVideoRendererId(self);
        private bool disposed;

        public UnityVideoRenderer(IntPtr ptr, VideoStreamTrack track)
        {
            self = ptr;
            this.track = track;
#if !UNITY_WEBGL
            NativeMethods.VideoTrackAddOrUpdateSink(track.GetSelfOrThrow(), self);
#endif
            WebRTC.Table.Add(self, this);
        }

        ~UnityVideoRenderer()
        {
            this.Dispose();
        }

        public void Dispose()
        {
            if (this.disposed)
            {
                return;
            }

            if (self != IntPtr.Zero)
            {
                IntPtr trackPtr = track.GetSelfOrThrow();
#if !UNITY_WEBGL
                if (trackPtr != IntPtr.Zero)
                {
                    NativeMethods.VideoTrackRemoveSink(trackPtr, self);
                }
#endif

                WebRTC.Context.DeleteVideoRenderer(self);
                WebRTC.Table.Remove(self);
                self = IntPtr.Zero;
            }

            this.disposed = true;
            GC.SuppressFinalize(this);
        }
    }
}
