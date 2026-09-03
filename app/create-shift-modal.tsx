'use client';

/**
 * EXAMPLE CODE — replace or remove before building a real app. See AGENTS.md.
 */
import { useState, useTransition } from 'react';
import { AlertCircleIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createShift } from './actions';

type UserOption = { id: string; name: string };

const UNASSIGNED = '__unassigned';

export function CreateShiftModal({ users = [] }: { users?: UserOption[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string>(UNASSIGNED);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isPending, startTransition] = useTransition();

  function reset() {
    setAssignee(UNASSIGNED);
    setStartTime('');
    setEndTime('');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('assignee', assignee === UNASSIGNED ? '' : assignee);
      formData.set('startTime', startTime);
      formData.set('endTime', endTime);
      const result = await createShift(formData);
      if (result.error) {
        setError(result.error);
      } else {
        handleOpenChange(false);
        window.location.reload();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          New Shift
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Shift</DialogTitle>
        </DialogHeader>

        <form id="create-shift-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assignee">Assignee</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger id="assignee" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="startTime">Start Time</Label>
            <Input
              type="datetime-local"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endTime">End Time</Label>
            <Input
              type="datetime-local"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-shift-form" disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            {isPending ? 'Creating…' : 'Create Shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
