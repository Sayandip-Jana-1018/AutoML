import { useState, useCallback, useRef } from 'react';

export interface HardwareVitals {
    ecg: number;
    leadsOn: boolean;
    ir: number;
    red: number;
    bpm: number;
    spo2: number; // Calculated on frontend or passed if available
}

export function useHardware() {
    const [isConnected, setIsConnected] = useState(false);
    const [hardwareVitals, setHardwareVitals] = useState<HardwareVitals | null>(null);
    const portRef = useRef<any>(null);
    const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

    const connect = useCallback(async () => {
        if (!('serial' in navigator)) {
            alert('Web Serial API not supported in this browser. Try Chrome or Edge.');
            return;
        }

        try {
            const port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate: 115200 });
            portRef.current = port;
            setIsConnected(true);

            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            const reader = textDecoder.readable.getReader();
            readerRef.current = reader;

            readLoop(reader);
        } catch (error) {
            console.error('Error connecting to serial port:', error);
            setIsConnected(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (readerRef.current) {
            await readerRef.current.cancel();
            readerRef.current = null;
        }
        if (portRef.current) {
            await portRef.current.close();
            portRef.current = null;
        }
        setIsConnected(false);
        setHardwareVitals(null);
    }, []);

    const readLoop = async (reader: ReadableStreamDefaultReader) => {
        let buffer = '';
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += value;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the incomplete line in buffer

                for (const line of lines) {
                    parseLine(line);
                }
            }
        } catch (error) {
            console.error('Error reading from serial:', error);
        } finally {
            reader.releaseLock();
        }
    };

    const parseLine = (line: string) => {
        // Expected format: timestamp, ecg_raw, leads_on, ir, red, bpm
        const parts = line.trim().split(',');
        if (parts.length >= 6) {
            const ecg = parseInt(parts[1]);
            const leadsOn = parseInt(parts[2]) === 1;
            const ir = parseInt(parts[3]);
            const red = parseInt(parts[4]);
            const bpm = parseInt(parts[5]);

            // Simple SpO2 estimation (very rough, usually needs calibration)
            // Ratio R = (AC_red/DC_red) / (AC_ir/DC_ir)
            // For now, let's just pass raw values or a placeholder if not calculated on Arduino
            // If IR < 50000, finger is likely off
            const spo2 = (ir > 50000) ? 98 : 0;

            setHardwareVitals({
                ecg,
                leadsOn,
                ir,
                red,
                bpm,
                spo2
            });
        }
    };

    return {
        isConnected,
        connect,
        disconnect,
        hardwareVitals
    };
}
