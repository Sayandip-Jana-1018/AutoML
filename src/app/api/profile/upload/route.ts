import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'profile');
const DATA_FILE = path.join(process.cwd(), 'data', 'profile.json');

// Helper to ensure upload directory exists
async function ensureUploadDir() {
    try {
        await fs.access(UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
}

// Helper to update profile avatar
async function updateProfileAvatar(avatarPath: string) {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        const profile = JSON.parse(data);
        profile.avatar = avatarPath;
        await fs.writeFile(DATA_FILE, JSON.stringify(profile, null, 2));
    } catch (error) {
        console.error('Failed to update profile json', error);
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;

        await ensureUploadDir();
        await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

        const avatarUrl = `/uploads/profile/${filename}`;
        await updateProfileAvatar(avatarUrl);

        return NextResponse.json({ avatar: avatarUrl });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}
