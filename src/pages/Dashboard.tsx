import { Link } from "react-router-dom";
import { Plus, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here's your interview practice overview.
          </p>
        </div>
        <Button asChild>
          <Link to="/setup">
            <Plus className="h-4 w-4 mr-2" />
            New Interview
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Total completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Across all sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0h</div>
            <p className="text-xs text-muted-foreground">Total time spent</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent interviews */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interviews</CardTitle>
          <CardDescription>
            Your most recent practice sessions will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No interviews yet"
            description="Start your first mock interview to see your history here."
            action={
              <Button asChild variant="outline">
                <Link to="/setup">Start an Interview</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}