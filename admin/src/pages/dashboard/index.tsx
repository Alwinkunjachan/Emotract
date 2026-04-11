import PageHead from '@/components/shared/page-head.jsx';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs.js';
import { GenderChart } from '@/components/charts/gender-chart.js';
import { MessageTrendLineChart } from '@/components/charts/line-chart.js';
import { useGetGenderDetails, useGetDashboardStats } from '../students/queries/queries';
import { Users, MessageSquare, Shield, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { data: genderData, isLoading: genderLoading } = useGetGenderDetails();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();

  return (
    <>
      <PageHead title="Dashboard | App" />
      <div className="max-h-screen flex-1 space-y-4 overflow-y-auto p-4 pt-6 md:p-8">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">
            Hi, Welcome back
          </h2>
        </div>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.totalUsers ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Registered users</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.totalMessages ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across all conversations
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Flagged Users</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.flaggedUsers ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.flaggedMessages > 0
                      ? `${stats.flaggedMessages} flagged messages`
                      : 'No flagged messages'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.onlineUsers ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.totalChats ?? 0} active conversations
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 gap-4 pb-5">
              {genderLoading ? (
                "Loading ..."
              ) : (
                <GenderChart data={genderData} />
              )}
            </div>
          </TabsContent>

          {/* ── Analytics Tab ── */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.totalChats ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active conversations</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Flagged Messages</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.flaggedMessages ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Content flagged for review</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Flagged Users</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '...' : stats?.flaggedUsers ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Accounts under review</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pb-5">
              <MessageTrendLineChart
                name="Message Trend"
                date="Last 30 days"
                data={stats?.messageTrend ?? []}
              />
              <Card>
                <CardHeader>
                  <CardTitle>User Registrations</CardTitle>
                  <p className="text-sm text-muted-foreground">Last 30 days</p>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    "Loading ..."
                  ) : stats?.registrationTrend?.length > 0 ? (
                    <div className="space-y-3">
                      {stats.registrationTrend.map((item: { _id: string; count: number }) => (
                        <div key={item._id} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {new Date(item._id).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${Math.max(item.count * 40, 20)}px` }}
                            />
                            <span className="text-sm font-medium">{item.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No registration data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
