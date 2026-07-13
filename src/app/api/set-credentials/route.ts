import { NextResponse } from 'next/server';

// ============================================================
//  MBA - SET CREDENTIALS API
//  Permite configurar credenciais das plataformas
// ============================================================

export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  var platform = body.platform || '';

  if (!platform) {
    return NextResponse.json({
      success: false,
      error: 'Especifica a plataforma (instagram, facebook, tiktok)',
      instructions: {
        instagram: {
          required: ['sessionid', 'csrftoken', 'ds_user_id'],
          howToGet: 'Abre Instagram no browser > DevTools (F12) > Application > Cookies > instagram.com. Copia sessionid, csrftoken, ds_user_id'
        },
        facebook: { required: ['email', 'password'], note: 'Login automatico' },
        tiktok: { required: ['username', 'password'], note: 'Login automatico' },
      }
    });
  }

  return NextResponse.json({
    success: true,
    platform: platform,
    message: `Credenciais para ${platform} recebidas. Guarda-as no localStorage e envia com cada pedido DM.`,
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint para configurar credenciais das plataformas',
    instagramCookieGuide: [
      '1. Abre instagram.com no teu browser e faz login',
      '2. Pressiona F12 para abrir DevTools',
      '3. Vai a Application > Cookies > https://www.instagram.com',
      '4. Copia os valores de: sessionid, csrftoken, ds_user_id',
      '5. Envia estes valores para este endpoint ou directamente com cada pedido DM',
    ],
  });
}