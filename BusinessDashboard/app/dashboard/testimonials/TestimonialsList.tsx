"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Check, Clock, Loader2, MessageSquareQuote, Search, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Testimonial } from "@/lib/types";
import { setTestimonialStatus } from "./actions";

const statusVariant: Record<Testimonial["status"], "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

// Returns a deterministic pastel background/text color combination based on the name
const getAvatarColor = (name: string) => {
  const colors = [
    "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30 fill-transparent"
          }`}
        />
      ))}
    </div>
  );
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

export default function TestimonialsList({ testimonials }: { testimonials: Testimonial[] }) {
  const [pending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filter & Sort state
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating-high" | "rating-low">("newest");

  // Calculate Dashboard Metrics
  const stats = useMemo(() => {
    const total = testimonials.length;
    const pendingCount = testimonials.filter((t) => t.status === "pending").length;
    const approvedCount = testimonials.filter((t) => t.status === "approved").length;
    const approvedWithRating = testimonials.filter((t) => t.status === "approved" && t.rating);
    
    const avgRating =
      approvedWithRating.length > 0
        ? approvedWithRating.reduce((sum, t) => sum + t.rating, 0) / approvedWithRating.length
        : 0;

    return {
      total,
      pending: pendingCount,
      approved: approvedCount,
      avgRating,
    };
  }, [testimonials]);

  const handleStatusChange = (t: Testimonial, status: "approved" | "rejected") => {
    setUpdatingId(t.id);
    startTransition(async () => {
      try {
        const result = await setTestimonialStatus(t.id, status);
        if (!result.ok) {
          toast.error(result.error);
        } else {
          toast.success(status === "approved" ? "Testimonial approved" : "Testimonial rejected");
        }
      } finally {
        setUpdatingId(null);
      }
    });
  };

  // Filter & Sort Testimonials list
  const filteredAndSortedTestimonials = useMemo(() => {
    return testimonials
      .filter((t) => {
        // 1. Tab Status Filter
        if (activeTab !== "all" && t.status !== activeTab) return false;
        
        // 2. Search Query Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchesName = t.customer_name.toLowerCase().includes(query);
          const matchesText = t.text.toLowerCase().includes(query);
          return matchesName || matchesText;
        }
        
        return true;
      })
      .sort((a, b) => {
        // 3. Sorting
        if (sortBy === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === "rating-high") {
          return b.rating - a.rating;
        }
        if (sortBy === "rating-low") {
          return a.rating - b.rating;
        }
        return 0;
      });
  }, [testimonials, activeTab, searchQuery, sortBy]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Dashboard metrics grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Metric 1: Avg Rating */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-card to-muted/20 border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average Rating</p>
              <div className="rounded-md bg-amber-500/10 p-1 text-amber-500">
                <Star className="size-4 fill-amber-500" />
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold tracking-tight">{stats.avgRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <StarRating rating={Math.round(stats.avgRating)} />
              <span className="text-xs text-muted-foreground">({stats.approved} approved reviews)</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Pending Approval */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-card to-muted/20 border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Approval</p>
              <div className="rounded-md bg-amber-500/10 p-1 text-amber-500">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold tracking-tight">{stats.pending}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {stats.pending > 0 ? "Requires review to publish on menu" : "All caught up!"}
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: Total Reviews */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-card to-muted/20 border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Feedbacks</p>
              <div className="rounded-md bg-primary/10 p-1 text-primary">
                <MessageSquareQuote className="size-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold tracking-tight">{stats.total}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Approved: {stats.approved} | Rejected: {stats.total - stats.approved - stats.pending}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Search, Status Tabs & Sorting Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-y py-4 my-1">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full lg:w-auto">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex bg-muted/60 p-1">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending
              {stats.pending > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {stats.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto lg:justify-end">
          <div className="relative w-full sm:max-w-[280px]">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or review..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-background"
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full sm:w-[170px] bg-background">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="rating-high">Highest Rating</SelectItem>
              <SelectItem value="rating-low">Lowest Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3. Testimonials feed */}
      <div className="flex flex-col gap-4">
        {filteredAndSortedTestimonials.map((t) => {
          const isUpdating = updatingId === t.id;
          return (
            <Card
              key={t.id}
              className={`group relative overflow-hidden transition-all duration-200 border shadow-sm hover:shadow-md hover:border-muted-foreground/20 ${
                t.status === "pending" ? "border-l-4 border-l-amber-500" : ""
              }`}
            >
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-sm shadow-sm select-none ${getAvatarColor(
                        t.customer_name
                      )}`}
                    >
                      {getInitials(t.customer_name)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground tracking-tight">
                          {t.customer_name}
                        </span>
                        <Badge
                          variant={statusVariant[t.status]}
                          className="capitalize font-medium text-[10px] py-0 px-2 select-none"
                        >
                          {t.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <StarRating rating={t.rating} />
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(t.created_at)}
                        </span>
                      </div>

                      <p className="pt-2 text-sm text-muted-foreground/90 leading-relaxed max-w-3xl whitespace-pre-line">
                        {t.text}
                      </p>

                      {/* Display rejection date/time if rejected */}
                      {t.status === "rejected" && t.rejected_at && (
                        <p className="text-xs text-destructive/80 font-medium pt-1 flex items-center gap-1 select-none">
                          <X className="size-3" />
                          Rejected on {formatDate(t.rejected_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-start sm:ml-auto shrink-0 select-none">
                    {t.status !== "approved" && (
                      <Button
                        size="sm"
                        disabled={pending || isUpdating}
                        onClick={() => handleStatusChange(t, "approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all duration-200"
                      >
                        {isUpdating ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1 size-3.5" />
                        )}
                        Approve
                      </Button>
                    )}
                    {t.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || isUpdating}
                        onClick={() => handleStatusChange(t, "rejected")}
                        className="text-destructive hover:text-destructive hover:bg-destructive/5 font-medium transition-all duration-200 border-muted-foreground/20"
                      >
                        {isUpdating ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <X className="mr-1 size-3.5" />
                        )}
                        Reject
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* 4. Empty State */}
        {filteredAndSortedTestimonials.length === 0 && (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <MessageSquareQuote className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-lg">No reviews found</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {searchQuery
                    ? `We couldn't find any reviews matching "${searchQuery}" in this view.`
                    : "No reviews exist for this status yet."}
                </p>
              </div>
              {(searchQuery || activeTab !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveTab("all");
                  }}
                  className="mt-2"
                >
                  Reset filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
