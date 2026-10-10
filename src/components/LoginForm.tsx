"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

export function LoginForm() {
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      
      if (res.ok) {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("wa_cached_campaigns")
            localStorage.removeItem("wa_cached_accounts")
            localStorage.removeItem("wa_cached_stats")
            localStorage.removeItem("wa_cached_followup")
          } catch {}
        }
        router.push("/whatsapp")
        router.refresh()
      } else {
        setError("Invalid password")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full shadow-[0_20px_50px_-15px_rgba(0,0,0,0.12)] bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-3xl overflow-hidden">
      <CardHeader className="pt-8 pb-5 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#164E43]/10 dark:bg-[#34D399]/10 border border-[#164E43]/20 dark:border-[#34D399]/20 flex items-center justify-center text-[#164E43] dark:text-[#34D399]">
          <Lock className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="px-7 pb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pr-10 rounded-xl bg-white dark:bg-[#121418] border-[#DFDAD0] dark:border-[#2A2E37] focus:ring-2 focus:ring-[#164E43]/30"
                required
              />
              <button
                type="button"
                className="absolute right-0 top-0 h-full px-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center pt-1">{error}</p>}
          </div>
          <Button
            type="submit"
            className="w-full h-11 bg-[#164E43] hover:bg-[#124238] text-white font-semibold rounded-xl shadow-sm transition-all"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
