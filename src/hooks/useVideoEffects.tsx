import { useRef, useState, useCallback, useEffect } from 'react';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

export type VideoEffect = 'none' | 'blur' | 'blur-strong';

interface UseVideoEffectsConfig {
  inputStream: MediaStream | null;
  effect: VideoEffect;
  enabled: boolean;
}

export const useVideoEffects = ({ inputStream, effect, enabled }: UseVideoEffectsConfig) => {
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  // Initialize MediaPipe segmenter
  const initializeSegmenter = useCallback(async () => {
    if (segmenterRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🎭 Initializing MediaPipe Image Segmenter...');
      
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });

      segmenterRef.current = segmenter;
      console.log('✅ MediaPipe Image Segmenter initialized');
    } catch (err) {
      console.error('❌ Failed to initialize segmenter:', err);
      setError('Failed to initialize background blur');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get blur radius based on effect
  const getBlurRadius = useCallback((effectType: VideoEffect): number => {
    switch (effectType) {
      case 'blur':
        return 10;
      case 'blur-strong':
        return 20;
      default:
        return 0;
    }
  }, []);

  // Process video frame with background blur
  const processFrame = useCallback(() => {
    if (!enabled || effect === 'none' || !segmenterRef.current || !videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (isProcessingRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    isProcessingRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx || video.readyState < 2) {
      isProcessingRef.current = false;
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      // Ensure canvas matches video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const startTimeMs = performance.now();
      const result = segmenterRef.current.segmentForVideo(video, startTimeMs);

      if (result.categoryMask) {
        const mask = result.categoryMask;
        const maskData = mask.getAsUint8Array();
        
        // Draw the original video frame
        ctx.drawImage(video, 0, 0);
        
        // Get the image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Create a blurred version
        const blurRadius = getBlurRadius(effect);
        ctx.filter = `blur(${blurRadius}px)`;
        ctx.drawImage(video, 0, 0);
        ctx.filter = 'none';
        
        const blurredImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const blurredPixels = blurredImageData.data;
        
        // Draw original again to work with
        ctx.drawImage(video, 0, 0);
        const finalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const finalPixels = finalImageData.data;
        
        // Blend based on mask
        for (let i = 0; i < maskData.length; i++) {
          const maskValue = maskData[i];
          const pixelIndex = i * 4;
          
          // Mask value: 0 = background, 255 = person
          const personAlpha = maskValue / 255;
          const backgroundAlpha = 1 - personAlpha;
          
          // Apply smooth edge blending
          finalPixels[pixelIndex] = Math.round(pixels[pixelIndex] * personAlpha + blurredPixels[pixelIndex] * backgroundAlpha);
          finalPixels[pixelIndex + 1] = Math.round(pixels[pixelIndex + 1] * personAlpha + blurredPixels[pixelIndex + 1] * backgroundAlpha);
          finalPixels[pixelIndex + 2] = Math.round(pixels[pixelIndex + 2] * personAlpha + blurredPixels[pixelIndex + 2] * backgroundAlpha);
        }
        
        ctx.putImageData(finalImageData, 0, 0);
        
        mask.close();
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }

    isProcessingRef.current = false;
    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [enabled, effect, getBlurRadius]);

  // Start processing when stream and effect are ready
  useEffect(() => {
    if (!inputStream || !enabled || effect === 'none') {
      // Return original stream when no effect
      if (inputStream && (!enabled || effect === 'none')) {
        setProcessedStream(inputStream);
      }
      return;
    }

    const videoTrack = inputStream.getVideoTracks()[0];
    if (!videoTrack) {
      setProcessedStream(inputStream);
      return;
    }

    // Initialize segmenter if needed
    initializeSegmenter();

    // Create video element for processing
    const video = document.createElement('video');
    video.srcObject = inputStream;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;

    // Create canvas for output
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.play();
    };

    video.onplay = () => {
      console.log('🎬 Video started, beginning frame processing');
      
      // Start processing loop
      animationFrameRef.current = requestAnimationFrame(processFrame);
      
      // Create output stream from canvas
      const canvasStream = canvas.captureStream(30);
      
      // Add original audio tracks
      inputStream.getAudioTracks().forEach(track => {
        canvasStream.addTrack(track);
      });
      
      setProcessedStream(canvasStream);
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current = null;
      }
    };
  }, [inputStream, enabled, effect, initializeSegmenter, processFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (segmenterRef.current) {
        segmenterRef.current.close();
        segmenterRef.current = null;
      }
    };
  }, []);

  return {
    processedStream: processedStream || inputStream,
    isLoading,
    error,
  };
};
