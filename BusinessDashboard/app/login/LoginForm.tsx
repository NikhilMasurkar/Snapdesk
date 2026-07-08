"use client";

import { useActionState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GoogleButton from "./GoogleButton";
import { login, signup } from "./actions";

export default function LoginForm({ justCreated }: { justCreated: boolean }) {
  const [loginState, loginAction, loginPending] = useActionState(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState(signup, undefined);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <GoogleButton />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <Tabs defaultValue="login" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Log in</TabsTrigger>
        <TabsTrigger value="signup">Create account</TabsTrigger>
      </TabsList>

      <TabsContent value="login">
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Log in to manage your business.</CardDescription>
          </CardHeader>
          <CardContent>
            {justCreated && (
              <p className="mb-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <CircleCheck className="mt-0.5 size-4 shrink-0" />
                Account created. Check your email if confirmation is required,
                then log in.
              </p>
            )}
            <form action={loginAction} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@business.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              {loginState?.error && (
                <p className="text-sm text-destructive">{loginState.error}</p>
              )}
              <Button type="submit" disabled={loginPending} className="w-full">
                {loginPending && <Loader2 className="animate-spin" />}
                Log in
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="signup">
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              For business owners onboarded by Snapdesk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signupAction} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@business.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </div>
              {signupState?.error && (
                <p className="text-sm text-destructive">{signupState.error}</p>
              )}
              <Button type="submit" disabled={signupPending} className="w-full">
                {signupPending && <Loader2 className="animate-spin" />}
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}
