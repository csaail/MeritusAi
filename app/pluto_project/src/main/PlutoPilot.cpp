#include "PlutoPilot.h"


  void onLoopStartAutoInsertion() {
  }

  void onLoopStopAutoInsertion() {
  }

  void plutoInit() {
    setUserLoopFrequency(100);
  }


  void onLoopStart () {
    onLoopStartAutoInsertion();
  }

  void plutoLoop () {
  }

  void onLoopFinish() {
    onLoopStopAutoInsertion();
  }
