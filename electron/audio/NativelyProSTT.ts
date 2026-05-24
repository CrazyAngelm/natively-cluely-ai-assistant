import { EventEmitter } from 'events';

export class NativelyProSTT extends EventEmitter {
    constructor(_apiKey: string, _channel: 'system' | 'mic' = 'system') {
        super();
        throw new Error('Original Natively STT is disabled in company fork. Configure Groq, OpenAI-compatible, or local Whisper STT.');
    }

    public setSampleRate(_rate: number): void {}
    public setAudioChannelCount(_count: number): void {}
    public setRecognitionLanguage(_languageKey: string): void {}
    public sendAudio(_audioData: Buffer): void {}
    public start(): void {}
    public stop(): void {}
    public finalize(): void {}
    public notifySpeechEnded(): void {}
}
