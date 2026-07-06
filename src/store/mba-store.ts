import { create } from 'zustand';

export interface DashboardData {
  overview: {
    totalProfiles: number;
    contactedToday: number;
    repliedToday: number;
    acceptedToday: number;
    totalCampaigns: number;
    activeCampaigns: number;
    totalMessages: number;
    outboundMessages: number;
    inboundMessages: number;
    responseRate: number;
  };
  statusBreakdown: { status: string; count: number }[];
  platformBreakdown: { platform: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  recentCampaigns: any[];
  dailyStats: { date: string; dayName: string; contacted: number; replied: number; accepted: number }[];
  topProfiles: any[];
}

export interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  sentAt: string;
}

export interface ProfileWithMessages {
  id: string;
  username: string;
  displayName: string | null;
  platform: string;
  followers: number;
  postsCount: number;
  score: number;
  status: string;
  category: string | null;
  campaignId: string;
  messages: ChatMessage[];
}

interface MBAStore {
  isAuthenticated: boolean;
  sessionId: string | null;
  activeTab: string;
  sessionRestored: boolean;
  isBooting: boolean;
  bootMessages: string[];
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  profiles: any[];
  profilesTotal: number;
  profilesLoading: boolean;
  prospectResults: any[];
  prospectLoading: boolean;
  prospectProgress: number;
  selectedProfile: ProfileWithMessages | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatSearch: string;
  activityLogs: string[];
  setAuthenticated: (val: boolean, id?: string) => void;
  setActiveTab: (tab: string) => void;
  startBoot: () => void;
  addBootMessage: (msg: string) => void;
  finishBoot: () => void;
  setDashboardData: (data: DashboardData | null) => void;
  setDashboardLoading: (val: boolean) => void;
  setProfiles: (profiles: any[], total: number) => void;
  setProfilesLoading: (val: boolean) => void;
  setProspectResults: (results: any[]) => void;
  setProspectLoading: (val: boolean) => void;
  setProspectProgress: (val: number) => void;
  setSelectedProfile: (profile: ProfileWithMessages | null) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatLoading: (val: boolean) => void;
  setChatSearch: (val: string) => void;
  setActivityLogs: (logs: string[]) => void;
  addActivityLog: (log: string) => void;
}

export const useMBAStore = create<MBAStore>((set) => ({
  isAuthenticated: false,
  sessionId: null,
  activeTab: 'dashboard',
  sessionRestored: false,
  isBooting: false,
  bootMessages: [],
  dashboardData: null,
  dashboardLoading: false,
  profiles: [],
  profilesTotal: 0,
  profilesLoading: false,
  prospectResults: [],
  prospectLoading: false,
  prospectProgress: 0,
  selectedProfile: null,
  chatMessages: [],
  chatLoading: false,
  chatSearch: '',
  activityLogs: [],
  setAuthenticated: (val, id) => set({ isAuthenticated: val, sessionId: id || null, sessionRestored: true }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  startBoot: () => set({ isBooting: true, bootMessages: [] }),
  addBootMessage: (msg) => set((s) => ({ bootMessages: [...s.bootMessages, msg] })),
  finishBoot: () => set({ isBooting: false, bootMessages: [] }),
  setDashboardData: (data) => set({ dashboardData: data }),
  setDashboardLoading: (val) => set({ dashboardLoading: val }),
  setProfiles: (profiles, total) => set({ profiles, profilesTotal: total }),
  setProfilesLoading: (val) => set({ profilesLoading: val }),
  setProspectResults: (results) => set({ prospectResults: results }),
  setProspectLoading: (val) => set({ prospectLoading: val }),
  setProspectProgress: (val) => set({ prospectProgress: val }),
  setSelectedProfile: (profile) => set({ selectedProfile: profile }),
  setChatMessages: (msgs) => set({ chatMessages: msgs }),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatLoading: (val) => set({ chatLoading: val }),
  setChatSearch: (val) => set({ chatSearch: val }),
  setActivityLogs: (logs) => set({ activityLogs: logs }),
  addActivityLog: (log) => set((s) => ({ activityLogs: [log, ...s.activityLogs].slice(0, 100) })),
}));