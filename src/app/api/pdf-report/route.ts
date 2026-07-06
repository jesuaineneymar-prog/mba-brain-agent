import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    totalProfiles: 0, totalMessages: 0, outbound: 0, inbound: 0,
    totalCampaigns: 0, responseRate: 0, byStatus: [], byPlatform: [],
    byCategory: [], dailyStats: [], topProfiles: [], campaigns: [], pendingFollowUps: 0,
  });
}