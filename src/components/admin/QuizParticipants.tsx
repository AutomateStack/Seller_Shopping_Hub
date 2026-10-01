import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Trophy, User, CheckCircle, XCircle } from "lucide-react";

interface Props {
  quizId: string;
  quizTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuizParticipants({ quizId, quizTitle, open, onOpenChange }: Props) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["quiz-participants", quizId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_id", quizId)
        .order("completed_at", { ascending: false });
      if (error) throw error;

      // Fetch profile info for all user_ids
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(a => ({
        ...a,
        email: profileMap.get(a.user_id)?.email || "Unknown",
        full_name: profileMap.get(a.user_id)?.full_name || "Unknown",
      }));
    },
  });

  const totalParticipants = attempts?.length || 0;
  const winners = attempts?.filter(a => a.prize_won).length || 0;
  const avgScore = totalParticipants > 0
    ? (attempts!.reduce((sum, a) => sum + a.score, 0) / totalParticipants).toFixed(1)
    : "0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Participants — {quizTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 my-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{totalParticipants}</p>
            <p className="text-xs text-muted-foreground">Total Participants</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{winners}</p>
            <p className="text-xs text-muted-foreground">Winners</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{avgScore}</p>
            <p className="text-xs text-muted-foreground">Avg Score (out of 5)</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : totalParticipants === 0 ? (
          <p className="text-center text-muted-foreground py-8">No participants yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Prize</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts?.map((a, idx) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{a.full_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                  <TableCell>
                    <span className="font-semibold">{a.score}/{a.total_questions}</span>
                  </TableCell>
                  <TableCell>
                    {a.prize_won ? (
                      <Badge className="bg-green-100 text-green-800 gap-1">
                        <CheckCircle className="h-3 w-3" /> Won
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" /> Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.prize_won ? (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <Trophy className="h-3 w-3" /> ₹{a.prize_amount}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(a.completed_at), "dd MMM yyyy, hh:mm a")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
