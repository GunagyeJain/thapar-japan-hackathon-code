// The human steps on an alert. "Request again" and "Notify passenger" show exactly what will go out first.
import { CheckCheck, ChefHat, CircleCheck, MessageSquare, RotateCw } from "lucide-react"
import type { ReactNode } from "react"

import type { Alert, PassengerWithPromise } from "@/lib/types"
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui"
import { useAlertAction, type ActionName } from "@/modules/m5-ops/data"
import { text } from "@/modules/m5-ops/evidence"
import { smsFor } from "@/modules/m5-ops/i18n"

interface ConfirmProps {
  trigger: ReactNode
  title: string
  description: string
  children: ReactNode
  confirm: string
  onConfirm: () => void
}

function Confirm({ trigger, title, description, children, confirm, onConfirm }: ConfirmProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onConfirm}>{confirm}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ActionBar({ alert, passenger, live }: { alert: Alert; passenger: PassengerWithPromise | undefined; live: boolean }) {
  const act = useAlertAction(live)
  const run = (action: ActionName) => act.mutate({ id: alert.id, action })
  const done = alert.status === "resolved"
  const promise = passenger?.promise
  const draft = text(alert.evidence.ssr_draft) ?? (promise ? `.R/${promise.code} HK1 ${promise.kitchen_note ?? ""}`.trim() : null)
  const sms = smsFor(alert, promise)

  return (
    <div className="flex flex-wrap gap-2">
      {alert.type === "LOST_MEAL" && (
        <Confirm
          trigger={
            <Button size="lg" disabled={done || act.isPending}>
              <RotateCw /> Request again
            </Button>
          }
          title="Request the meal again"
          description="A staff member approves every fix. Nothing in the booking system changes on its own."
          confirm="Approve and send"
          onConfirm={() => run("request_again")}
        >
          <figure className="rounded-lg border bg-mist p-3">
            <figcaption className="pb-1 text-xs text-muted-foreground">SSR line to add to {alert.evidence.new_pnr ? String(alert.evidence.new_pnr) : "the booking"}</figcaption>
            <pre className="code text-sm">{draft ?? "—"}</pre>
          </figure>
        </Confirm>
      )}
      <Confirm
        trigger={
          <Button size="lg" variant="outline" disabled={!alert.passenger_id || act.isPending}>
            <MessageSquare /> Notify passenger
          </Button>
        }
        title="Message the passenger"
        description="Sent as an SMS in the passenger's language, with English."
        confirm="Send"
        onConfirm={() => run("notify_passenger")}
      >
        <div className="flex flex-col gap-2 text-sm">
          <p className="rounded-lg border p-3">{sms.en}</p>
          <p lang="hi" className="rounded-lg border p-3">
            {sms.hi}
          </p>
        </div>
      </Confirm>
      {alert.type === "DELAY_HOLD" && (
        <Button size="lg" variant="outline" disabled={done || act.isPending} onClick={() => run("notify_kitchen")}>
          <ChefHat /> Notify kitchen
        </Button>
      )}
      <Button size="lg" variant="outline" disabled={done || alert.status === "acknowledged" || act.isPending} onClick={() => run("acknowledge")}>
        <CheckCheck /> Acknowledge
      </Button>
      <Button size="lg" variant="outline" disabled={done || act.isPending} onClick={() => run("resolve")}>
        <CircleCheck /> Resolve
      </Button>
    </div>
  )
}
