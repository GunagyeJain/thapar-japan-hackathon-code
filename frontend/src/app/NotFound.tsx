import { Link } from "react-router"

import { Button } from "@/ui/button"

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 px-6 py-20">
      <p className="text-sm font-medium text-grey">404</p>
      <h1 className="text-2xl font-bold text-navy">This page isn't part of JL740's plan</h1>
      <p className="text-grey">Check the address, or go back to the flight overview.</p>
      <Button asChild>
        <Link to="/">Go to JL740 overview</Link>
      </Button>
    </div>
  )
}
