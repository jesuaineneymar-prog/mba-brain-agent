import { NextResponse } from 'next/server';

// Direct scraping using real cookies for each platform
// This runs as a server-side API route

export async function POST(request: Request) {
  try {
    const { platform, action, target, data } = await request.json();

    switch (platform) {
      case 'instagram':
        return await scrapeInstagram(action, target, data);
      case 'facebook':
        return await scrapeFacebook(action, target, data);
      case 'linkedin':
        return await scrapeLinkedIn(action, target, data);
      case 'tiktok':
        return await scrapeTikTok(action, target, data);
      default:
        return NextResponse.json({ error: 'Plataforma não suportada' }, { status: 400 });
    }
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Erro no scraping' }, { status: 500 });
  }
}

// ─── INSTAGRAM ─────────────────────────────────────────────────
async function scrapeInstagram(action: string, target: string, data: any) {
  const cookies = `sessionid=${process.env.IG_SESSIONID}; csrftoken=${process.env.IG_CSRFTOKEN}`;

  if (action === 'search') {
    // Search Instagram profiles by keyword
    const res = await fetch(
      `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(target + ' Angola')}&context=blended`,
      {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'X-CSRFToken': process.env.IG_CSRFTOKEN || '',
          'X-IG-App-ID': '936619743392459',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Instagram API: ${res.status}`, platform: 'instagram' }, { status: res.status });
    }

    const json = await res.json();
    const users = json.users?.map((u: any) => ({
      platform: 'instagram',
      username: u.user?.username || '',
      displayName: u.user?.full_name || '',
      followers: u.user?.follower_count || 0,
      following: u.user?.following_count || 0,
      postsCount: u.user?.media_count || 0,
      isVerified: u.user?.is_verified || false,
      profilePicUrl: u.user?.profile_pic_url || '',
      profileUrl: `https://instagram.com/${u.user?.username}`,
      bio: (u.user?.biography || '').substring(0, 200),
      isBusiness: u.user?.is_business_account || false,
      category: u.user?.category_name || '',
    })) || [];

    return NextResponse.json({ success: true, platform: 'instagram', results: users });
  }

  if (action === 'profile') {
    // Get specific profile info
    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${target}`, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-CSRFToken': process.env.IG_CSRFTOKEN || '',
        'X-IG-App-ID': '936619743392459',
      },
    });

    if (!res.ok) return NextResponse.json({ error: `Instagram: ${res.status}` }, { status: res.status });
    const json = await res.json();
    const user = json.data?.user;
    return NextResponse.json({
      success: true,
      platform: 'instagram',
      profile: {
        username: user?.username, displayName: user?.full_name,
        followers: user?.edge_followed_by?.count, following: user?.edge_follow?.count,
        postsCount: user?.edge_owner_to_timeline_media?.count,
        bio: user?.biography, isVerified: user?.is_verified,
        isBusiness: user?.is_business_account, category: user?.business_category_name,
      },
    });
  }

  return NextResponse.json({ error: 'Acção não suportada para Instagram' }, { status: 400 });
}

// ─── FACEBOOK ──────────────────────────────────────────────────
async function scrapeFacebook(action: string, target: string, data: any) {
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (action === 'search') {
    // Use Facebook Graph API with access token
    const res = await fetch(
      `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(target + ' Angola')}&fields=id,name,username,fan_count,followers_count,category,description,phone,website,picture.width(100).height(100)&limit=${data?.limit || 50}&access_token=${accessToken}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Facebook: ${err}`, platform: 'facebook' }, { status: res.status });
    }

    const json = await res.json();
    const pages = (json.data || []).map((p: any) => ({
      platform: 'facebook',
      username: p.username || `page_${p.id}`,
      displayName: p.name || '',
      followers: p.fan_count || p.followers_count || 0,
      following: 0,
      postsCount: 0,
      isVerified: false,
      isBusiness: true,
      profilePicUrl: p.picture?.data?.url || '',
      profileUrl: p.username ? `https://facebook.com/${p.username}` : `https://facebook.com/${p.id}`,
      bio: (p.description || '').substring(0, 200),
      category: p.category || '',
      externalId: p.id,
    }));

    return NextResponse.json({ success: true, platform: 'facebook', results: pages });
  }

  if (action === 'profile') {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${target}?fields=id,name,username,fan_count,followers_count,category,description,phone,website,picture.width(100).height(100),engagement&access_token=${accessToken}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!res.ok) return NextResponse.json({ error: `Facebook: ${res.status}` }, { status: res.status });
    const p = await res.json();
    return NextResponse.json({
      success: true, platform: 'facebook',
      profile: {
        username: p.username, displayName: p.name,
        followers: p.fan_count || p.followers_count,
        bio: p.description, category: p.category, isBusiness: true,
      },
    });
  }

  return NextResponse.json({ error: 'Acção não suportada para Facebook' }, { status: 400 });
}

// ─── LINKEDIN ──────────────────────────────────────────────────
async function scrapeLinkedIn(action: string, target: string, data: any) {
  const cookies = `li_at=${process.env.LI_AT}`;

  if (action === 'search') {
    // LinkedIn search via their internal API
    const res = await fetch(
      `https://www.linkedin.com/graphql?query=${encodeURIComponent(target + ' Angola')}`,
      {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'pt-PT,pt;q=0.9',
          'X-Li-Track': '{"clientVersion":"*"}',
        },
      }
    );

    // LinkedIn heavily blocks scraping, return what we can
    if (!res.ok) {
      return NextResponse.json({
        success: false,
        platform: 'linkedin',
        error: `LinkedIn bloqueou o request (${res.status}). A usar Apify como fallback.`,
        suggestion: 'Usa a prospecção via Apify para LinkedIn — é mais fiável.',
      }, { status: 200 });
    }

    const text = await res.text();
    return NextResponse.json({ success: true, platform: 'linkedin', raw: text.substring(0, 500) });
  }

  if (action === 'profile') {
    const res = await fetch(`https://www.linkedin.com/in/${target}`, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `LinkedIn: ${res.status}` }, { status: res.status });
    }

    const html = await res.text();
    // Extract basic info from HTML
    const nameMatch = html.match(/"title":"([^"]+)"/);
    return NextResponse.json({
      success: true, platform: 'linkedin',
      profile: { displayName: nameMatch?.[1] || target, username: target },
    });
  }

  return NextResponse.json({ error: 'Acção não suportada para LinkedIn' }, { status: 400 });
}

// ─── TIKTOK ────────────────────────────────────────────────────
async function scrapeTikTok(action: string, target: string, data: any) {
  const cookies = `sessionid=${process.env.TT_SESSIONID}; tt_csrf_token=${process.env.TT_CSRF_TOKEN}`;

  if (action === 'search') {
    const res = await fetch(
      `https://www.tiktok.com/api/search/user/general/?keyword=${encodeURIComponent(target + ' Angola')}&count=${data?.limit || 30}&offset=0`,
      {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.tiktok.com/',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `TikTok: ${res.status}`, platform: 'tiktok' }, { status: res.status });
    }

    const json = await res.json();
    const users = (json.user_list || []).map((u: any) => ({
      platform: 'tiktok',
      username: u.user_info?.unique_id || '',
      displayName: u.user_info?.nickname || '',
      followers: u.user_info?.follower_count || 0,
      following: u.user_info?.following_count || 0,
      postsCount: u.user_info?.video_count || 0,
      isVerified: u.user_info?.verified || false,
      isBusiness: false,
      profilePicUrl: u.user_info?.avatar_larger?.url_list?.[0] || '',
      profileUrl: `https://tiktok.com/@${u.user_info?.unique_id}`,
      bio: (u.user_info?.signature || '').substring(0, 200),
      category: '',
      externalId: u.user_info?.uid || '',
    }));

    return NextResponse.json({ success: true, platform: 'tiktok', results: users });
  }

  if (action === 'profile') {
    const res = await fetch(`https://www.tiktok.com/@${target}`, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) return NextResponse.json({ error: `TikTok: ${res.status}` }, { status: res.status });
    const html = await res.text();

    // Extract from SSR data
    const dataMatch = html.match(/"user":(\{[^}]+\})/);
    if (dataMatch) {
      try {
        const userData = JSON.parse(dataMatch[1]);
        return NextResponse.json({
          success: true, platform: 'tiktok',
          profile: {
            username: userData.uniqueId, displayName: userData.nickname,
            followers: userData.followerCount, following: userData.followingCount,
            postsCount: userData.videoCount, bio: userData.signature,
            isVerified: userData.verified,
          },
        });
      } catch {}
    }

    return NextResponse.json({ success: true, platform: 'tiktok', profile: { username: target } });
  }

  return NextResponse.json({ error: 'Acção não suportada para TikTok' }, { status: 400 });
}