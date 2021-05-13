var UnityWebRTCMediaStream = {
  CreateMediaStream: function () {
    var stream = new MediaStream();
    stream.onaddtrack = function (evt) {
      uwcom_addManageObj(evt.track);
      console.log('stream.ontrack' + evt.track.managePtr);
      Module.dynCall_vii(uwevt_MSOnAddTrack, this.managePtr, evt.track.managePtr);
    };
    stream.onremovetrack = function (evt) {
      if (!evt.track.managePtr) {
          console.warn('track does not own managePtr');
        return;
      }
      if (!uwcom_existsCheck(evt.track.managePtr, 'stream.onremovetrack', 'track')) return;
      Module.dynCall_vii(uwevt_MSOnRemoveTrack, this.memberPtr, evt.track.managePtr);
    };

    uwcom_addManageObj(stream);
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'CreateMediaStream', stream.managePtr);
    return stream.managePtr;
  },

  DeleteMediaStream: function(streamPtr) {
    var stream = UWManaged[streamPtr];
    stream.getTracks().forEach(function(track) {
      track.stop();
      stream.removeTrack(track);
      track = null;
    });
    stream = null;
    delete UWManaged[streamPtr];
  },

  MediaStreamGetID: function (streamPtr) {
    if (!uwcom_existsCheck(streamPtr, 'MediaStreamGetID', 'stream')) return;
    var stream = UWManaged[streamPtr];
    var streamIdPtr = uwcom_strToPtr(stream.id);
    return streamIdPtr;
  },

  MediaStreamGetVideoTracks: function (streamPtr) {
    if (!uwcom_existsCheck(streamPtr, 'MediaStreamGetVideoTracks', 'stream')) return;
    var tracks = stream.getVideoTracks();
    var ptrs = [];
    tracks.forEach(function (track) {
      uwcom_addManageObj(track);
      ptrs.push(track.managePtr);
    });
    var ptr = uwcom_arrayToReturnPtr(ptrs, Int32Array);
    return ptr;
  },

  MediaStreamGetAudioTracks: function (streamPtr) {
    if (!uwcom_existsCheck(streamPtr, 'MediaStreamGetAudioTracks', 'stream')) return;
    var tracks = stream.getAudioTracks();
    var ptrs = [];
    tracks.forEach(function (track) {
      uwcom_addManageObj(track);
      ptrs.push(track.managePtr);
    });
    var ptr = uwcom_arrayToReturnPtr(ptrs, Int32Array);
    return ptr;
  },

  MediaStreamAddTrack: function (streamPtr, trackPtr) {
    if (!uwcom_existsCheck(streamPtr, 'MediaStreamAddTrack', 'stream')) return;
    if (!uwcom_existsCheck(trackPtr, 'MediaStreamAddTrack', 'track')) return;
    var stream = UWManaged[streamPtr];
    var track = UWManaged[trackPtr];
    console.log('videoTrack:' + track.id);
    try {
      console.log('MediaStreamAddTrack:' + streamPtr + ':' + trackPtr);
      stream.addTrack(track);
      var video = document.createElement('video');
      video.id = 'video_' + track.managePtr.toString();
      video.muted = true;
      //video.style.display = 'none';
      video.srcObject = stream;
      document.body.appendChild(video);
      video.style.width = '300px';
      video.style.height = '200px';
      video.style.position = 'absolute';
      video.style.left = video.style.top = 0;
      uwcom_remoteVideoTracks[track.managePtr] = {
        track: track,
        video: video
      };
      video.play(); 
      Module.dynCall_vii(uwevt_MSOnAddTrack, stream.managePtr, track.managePtr);
      return true;
    } catch (err) {
        console.log('MediaStreamAddTrack: ' + err.message);
      return false;
    }
  },

  MediaStreamRemoveTrack: function (streamPtr, trackPtr) {
    if (!uwcom_existsCheck(streamPtr, 'MediaStreamRemoveTrack', 'stream')) return;
    if (!uwcom_existsCheck(trackPtr, 'MediaStreamRemoveTrack', 'track')) return;
    var stream = UWManaged[streamPtr];
    var track = UWManaged[trackPtr];
    try {
      stream.removeTrack(track);
      return true;
    } catch (err) {
        console.log('MediaStreamRemoveTrack: ' + err.message);
      return false;
    }
  }
};
mergeInto(LibraryManager.library, UnityWebRTCMediaStream);