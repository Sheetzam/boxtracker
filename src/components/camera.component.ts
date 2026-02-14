import { Component, ElementRef, ViewChild, output, signal, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      @if (error()) {
        <div class="absolute inset-0 flex items-center justify-center text-red-500 p-4 text-center">
          <p>{{ error() }}</p>
        </div>
      }
      
      <video #videoElement 
        class="w-full h-full object-cover" 
        autoplay playsinline muted>
      </video>

      <!-- Shutter Flash Animation -->
      @if (isFlashing()) {
        <div class="absolute inset-0 bg-white animate-pulse opacity-50 pointer-events-none"></div>
      }
      
      <canvas #canvasElement class="hidden"></canvas>
    </div>
  `
})
export class CameraComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  
  imageCaptured = output<string>();
  error = signal<string>('');
  isFlashing = signal(false);
  
  private stream: MediaStream | null = null;

  async ngAfterViewInit() {
    await this.startCamera();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      this.error.set('Camera access denied. Please enable permissions.');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  capture() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    this.isFlashing.set(true);
    setTimeout(() => this.isFlashing.set(false), 200);

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Get base64 string without the prefix for easier API handling usually, 
      // but Gemini needs it clean.
      // toDataURL returns "data:image/png;base64,..."
      const fullDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      // Remove prefix for Gemini
      const base64Content = fullDataUrl.split(',')[1]; 
      this.imageCaptured.emit(base64Content);
    }
  }
}