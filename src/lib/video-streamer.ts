export class VideoStreamer {
  private videoElement: HTMLVideoElement;
  private canvasElement: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;
  private onFrame: (base64Data: string) => void;
  private isScreenShare: boolean;

  constructor(onFrame: (base64Data: string) => void, isScreenShare: boolean = false) {
    this.onFrame = onFrame;
    this.isScreenShare = isScreenShare;
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    
    this.canvasElement = document.createElement('canvas');
    // Use higher resolution for screen sharing so SARA can read text clearly
    this.canvasElement.width = this.isScreenShare ? 1280 : 640;
    this.canvasElement.height = this.isScreenShare ? 720 : 480;
    this.ctx = this.canvasElement.getContext('2d');
  }

  async start() {
    try {
      if (this.isScreenShare) {
        this.stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { max: 5 }
          } 
        });
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      }
      
      this.videoElement.srcObject = this.stream;
      
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          resolve(true);
        };
      });

      // Capture a frame every 1 second (1 fps is usually enough for Live API vision)
      this.intervalId = window.setInterval(() => this.captureFrame(), 1000);
    } catch (err) {
      console.error("Failed to start video stream:", err);
      throw err;
    }
  }

  private captureFrame() {
    if (!this.ctx || !this.videoElement.videoWidth) return;
    
    // Draw video frame to canvas
    this.ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Get base64 jpeg
    const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.5);
    // Remove the data:image/jpeg;base64, prefix
    const base64Data = dataUrl.split(',')[1];
    
    if (base64Data) {
      this.onFrame(base64Data);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.videoElement.srcObject = null;
  }
}
