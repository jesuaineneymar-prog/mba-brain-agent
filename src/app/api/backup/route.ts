import { NextResponse } from 'next/server';
import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import { writeFile } from 'fs/promises';

const DB_PATH = join(process.cwd(), 'db', 'custom.db');
const BACKUP_DIR = join(process.cwd(), 'db', 'backups');

export async function GET() {
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    if (!existsSync(DB_PATH)) return NextResponse.json({ error: 'Base de dados não encontrada' }, { status: 404 });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `mba-backup-${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, backupName);
    const dbBuffer = readFileSync(DB_PATH);
    await writeFile(backupPath, dbBuffer);
    return NextResponse.json({ success: true, backupName, size: dbBuffer.length });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar backup' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, backupName } = await request.json();
    if (action === 'list') {
      if (!existsSync(BACKUP_DIR)) return NextResponse.json({ backups: [] });
      const { readdirSync, statSync } = await import('fs');
      const files = readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).map(f => ({
        name: f,
        size: statSync(join(BACKUP_DIR, f)).size,
        date: statSync(join(BACKUP_DIR, f)).mtime.toISOString(),
      })).sort((a, b) => b.date.localeCompare(a.date));
      return NextResponse.json({ backups: files });
    }
    if (action === 'restore' && backupName) {
      const backupPath = join(BACKUP_DIR, backupName);
      if (!existsSync(backupPath)) return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
      copyFileSync(backupPath, DB_PATH);
      return NextResponse.json({ success: true, restored: backupName });
    }
    return NextResponse.json({ error: 'Acção inválida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao restaurar' }, { status: 500 });
  }
}