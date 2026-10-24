// Reset the demo data, keeping the judges who joined (or not), after a confirm.
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { useState } from "react"

import { api } from "@/lib/api"
import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
} from "@/ui"

export function ResetButton({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [keepJudges, setKeepJudges] = useState(true)
  const reset = useMutation({
    mutationFn: () => api.post<{ ok: boolean; seed_epoch: number }>("/demo/reset", { keep_judges: keepJudges }),
    onSuccess: (res) => {
      setOpen(false)
      onDone()
      queryClient.invalidateQueries()
      toast.success(`Demo reset (epoch ${res.seed_epoch}). Clock back to 23 Oct 18:00 IST.`)
    },
    onError: (e) => toast.error(`Reset failed: ${e.message}`),
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw /> Reset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset the demo?</DialogTitle>
          <DialogDescription>
            All alerts, reservations, scans and meal lists go back to the seed, and the sim clock to 23 Oct 18:00 IST. Crew
            tablets drop events from before the reset.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={keepJudges} onCheckedChange={(on) => setKeepJudges(on === true)} />
          Keep the judges who joined
        </label>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" disabled={reset.isPending} onClick={() => reset.mutate()}>
            Reset now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
