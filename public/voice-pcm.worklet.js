class PcmBlockProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.blockSize = (options && options.processorOptions && options.processorOptions.blockSize) || 512;
    this.block = new Float32Array(this.blockSize);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) {
      return true;
    }
    for (const sample of channel) {
      this.block[this.filled] = sample;
      this.filled += 1;
      if (this.filled === this.blockSize) {
        const copy = this.block.slice();
        this.port.postMessage(copy, [copy.buffer]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-block', PcmBlockProcessor);
