var UnityWebRTCIceCandidate = {
  DeleteIceCandidate: function (candidatePtr) {
    if (!uwcom_existsCheck(candidatePtr, 'DeleteIceCandidate', 'iceCandidate')) return;
    delete UWManaged[candidatePtr];
  }
};
mergeInto(LibraryManager.library, UnityWebRTCIceCandidate);