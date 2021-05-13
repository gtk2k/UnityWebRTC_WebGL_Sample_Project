using System;
using System.Collections;
using System.Collections.Generic;
using Unity.WebRTC;
using Unity.WebRTC.Signaling;
using UnityEngine;
using UnityEngine.UI;

public class WebRTCManager : MonoBehaviour
{
    public Button connectButton;
    public string SignalingUrl;

    private RTCOfferOptions offerOptions = new RTCOfferOptions
    {
        iceRestart = false,
        offerToReceiveVideo = true,
        offerToReceiveAudio = false
    };
    private RTCAnswerOptions answerOptions = new RTCAnswerOptions
    {
        iceRestart = false
    };

    private class SignalingMessage
    {
        public string joinId;
        public string leaveId;
        public string type;
        public string sdp;
        public string candidate;
        public string sdpMid;
        public int sdpMLineIndex;
        public string srcId; // send source Id
        public string dstId; // send destination Id
    }

    public GameObject peerPrefab;
    public Transform peersListContainer;
    public Camera streamCamera;
    private Dictionary<string, RTCPeerConnection> peers;
    private Dictionary<string, GameObject> peerItems;
    private Dictionary<string, MediaStream> streams;

    void Start()
    {
        WebRTC.Initialize(EncoderType.Software);
        StartCoroutine(WebRTC.Update());

        peers = new Dictionary<string, RTCPeerConnection>();
        streams = new Dictionary<string, MediaStream>();

        connectButton.onClick.AddListener(() =>
        {
            WebSocketSignaling.Init(SignalingUrl);
            WebSocketSignaling.OnOpen += WebSocketSignaling_OnOpen;
            WebSocketSignaling.OnClose += WebSocketSignaling_OnClose;
            WebSocketSignaling.OnError += WebSocketSignaling_OnError;
            WebSocketSignaling.OnMessage += WebSocketSignaling_OnMessage;

            WebSocketSignaling.Connect(SignalingUrl);
        });
    }

    private void WebSocketSignaling_OnOpen()
    {
        Debug.Log("______[Signaling OnOpen]");
    }

    private void WebSocketSignaling_OnMessage(string data)
    {
        var msg = JsonUtility.FromJson<SignalingMessage>(data);
        Debug.Log($"______[Signaling OnMessage] type:{msg.type} dstId:{msg.dstId}");

        Debug.Log("______1");
        if (!string.IsNullOrEmpty(msg.joinId))
        {
            Debug.Log($"______Join: {msg.joinId}");
            createPeer(msg.joinId, true);
            Debug.Log("______4");
            return;
        }

        Debug.Log("______5");
        if (!string.IsNullOrEmpty(msg.leaveId))
        {
            Debug.Log($"______Leave: {msg.leaveId}");
            peers.Remove(msg.leaveId);
            Debug.Log("______6");
            Destroy(peerItems[msg.leaveId]);
            Debug.Log("______7");
            peerItems.Remove(msg.leaveId);
        }

        Debug.Log("______8");
        if (!peers.ContainsKey(msg.srcId))
        {
            Debug.Log("______9");
            createPeer(msg.srcId);
        }

        Debug.Log("______10");
        if (!string.IsNullOrEmpty(msg.sdp))
        {
            Debug.Log("______11");
            var type = msg.type == "offer" ? RTCSdpType.Offer : RTCSdpType.Answer;
            Debug.Log("______12");
            StartCoroutine(setDesc(msg.srcId, type, msg.sdp));
        }

        Debug.Log("______13");
        if (!string.IsNullOrEmpty(msg.candidate))
        {
            Debug.Log("______14");
            var candidate = new RTCIceCandidate(msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
            Debug.Log("______15");
            peers[msg.srcId].AddIceCandidate(candidate);
        }
    }

    private void WebSocketSignaling_OnClose(string reason, int code)
    {
        Debug.Log($"______[Signaling OnClose] Reason:{reason} Code:{code}");
    }

    private void WebSocketSignaling_OnError()
    {
        Debug.LogError("______[Signaling OnError]");
    }

    private void createPeer(string id, bool caller = false)
    {
        Debug.Log($"______id:{id}");
        Debug.Log("______A");
        RTCConfiguration config = default;
        Debug.Log("______B");
        config.iceServers = new RTCIceServer[]
        {
            new RTCIceServer { urls = new string[] { "stun:stun.l.google.com:19302" } }
        };
        Debug.Log("______C");
        var pc = new RTCPeerConnection(ref config);
        Debug.Log("______D");
        peers.Add(id, pc);

        Debug.Log("______E");
        pc.OnIceCandidate = candidate =>
        {
            Debug.Log("______F");
            var msg = new SignalingMessage
            {
                type = "candidate",
                candidate = candidate.Candidate,
                sdpMid = candidate.SdpMid,
                sdpMLineIndex = candidate.SdpMLineIndex.Value,
                dstId = id
            };
            Debug.Log("______[Send candidate]");
            WebSocketSignaling.Send(JsonUtility.ToJson(msg));
        };

        Debug.Log("______G");
        pc.OnTrack = evt =>
        {
            Debug.Log("______GA");
            if (evt.Track is VideoStreamTrack videoTrack)
            {
                var mediaStream = new MediaStream();
                mediaStream.AddTrack(videoTrack);
                Debug.Log("______GB");
                var rt = videoTrack.InitializeReceiver(1920, 1080);
                Debug.Log("______GC");
                var peerItem = Instantiate(peerPrefab, peersListContainer);
                Debug.Log("______GD");
                peerItem.GetComponent<RawImage>().texture = rt;
                Debug.Log("______GE");
            }
        };

        var videoStreamTrack = streamCamera.CaptureStreamTrack(1920, 1080, 5000000);
        pc.AddTrack(videoStreamTrack);

        Debug.Log("______H");
        if (caller)
        {
            Debug.Log("______I");
            Debug.Log("______J");
            Debug.Log("______k");
            StartCoroutine(createDesc(id, RTCSdpType.Offer));
            Debug.Log("______L");
        }
    }

    private IEnumerator createDesc(string id, RTCSdpType type)
    {
        Debug.Log("______a");
        var pc = peers[id];
        Debug.Log("______b");
        var opDesc = type == RTCSdpType.Offer ?
            pc.CreateOffer(ref offerOptions) :
            pc.CreateAnswer(ref answerOptions);
        yield return opDesc;

        Debug.Log("______c");
        if (opDesc.IsError)
        {
            Debug.LogError(opDesc.Error.message);
            yield break;
        }

        Debug.Log("______d");
        var desc = opDesc.Desc;
        Debug.Log("______e");
        var opSetDesc = pc.SetLocalDescription(ref desc);
        Debug.Log("______f");
        if (opSetDesc.IsError)
        {
            Debug.LogError($"______{opSetDesc.Error.message}");
            yield break;
        }

        var msg = new SignalingMessage
        {
            type = desc.type.ToString().ToLower(),
            sdp = desc.sdp,
            dstId = id
        };
        Debug.Log($"______[Send {msg.type}] dstId:{msg.dstId}");
        WebSocketSignaling.Send(JsonUtility.ToJson(msg));
    }

    private IEnumerator setDesc(string id, RTCSdpType type, string sdp)
    {
        var pc = peers[id];
        var desc = new RTCSessionDescription { type = type, sdp = sdp };
        var opSetDesc = pc.SetRemoteDescription(ref desc);
        yield return opSetDesc;

        if (opSetDesc.IsError)
        {
            Debug.LogError($"______{opSetDesc.Error.message}");
            yield break;
        }

        if (type == RTCSdpType.Offer)
        {
            yield return StartCoroutine(createDesc(id, RTCSdpType.Answer));
        }
    }
}
