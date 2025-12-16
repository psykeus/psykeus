"use client";

import {
  Inbox,
  FileX,
  Search,
  FolderOpen,
  Users,
  Package,
  Image,
  Tag,
  Heart,
  Bookmark,
  Download,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

// =============================================================================
// Base Empty State
// =============================================================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-sm mb-4">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex gap-2">
          {action && (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// No Results (for search)
// =============================================================================

interface NoResultsProps {
  query?: string;
  onClear?: () => void;
  className?: string;
}

export function NoResults({ query, onClear, className }: NoResultsProps) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        query
          ? `No results found for "${query}". Try adjusting your search or filters.`
          : "No results match your current filters."
      }
      action={onClear ? { label: "Clear search", onClick: onClear } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Designs
// =============================================================================

interface NoDesignsProps {
  onUpload?: () => void;
  className?: string;
}

export function NoDesigns({ onUpload, className }: NoDesignsProps) {
  return (
    <EmptyState
      icon={Image}
      title="No designs yet"
      description="Upload your first design to get started with your library."
      action={onUpload ? { label: "Upload design", onClick: onUpload } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Files
// =============================================================================

interface NoFilesProps {
  onUpload?: () => void;
  className?: string;
}

export function NoFiles({ onUpload, className }: NoFilesProps) {
  return (
    <EmptyState
      icon={FileX}
      title="No files"
      description="This design doesn't have any files attached yet."
      action={onUpload ? { label: "Upload file", onClick: onUpload } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Users
// =============================================================================

interface NoUsersProps {
  onInvite?: () => void;
  className?: string;
}

export function NoUsers({ onInvite, className }: NoUsersProps) {
  return (
    <EmptyState
      icon={Users}
      title="No users found"
      description="There are no users matching your search criteria."
      action={onInvite ? { label: "Invite user", onClick: onInvite } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Tags
// =============================================================================

interface NoTagsProps {
  onCreate?: () => void;
  className?: string;
}

export function NoTags({ onCreate, className }: NoTagsProps) {
  return (
    <EmptyState
      icon={Tag}
      title="No tags"
      description="Create tags to help organize and find your designs."
      action={onCreate ? { label: "Create tag", onClick: onCreate } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Favorites
// =============================================================================

interface NoFavoritesProps {
  onBrowse?: () => void;
  className?: string;
}

export function NoFavorites({ onBrowse, className }: NoFavoritesProps) {
  return (
    <EmptyState
      icon={Heart}
      title="No favorites yet"
      description="Browse designs and click the heart icon to add them to your favorites."
      action={onBrowse ? { label: "Browse designs", onClick: onBrowse } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Collections
// =============================================================================

interface NoCollectionsProps {
  onCreate?: () => void;
  className?: string;
}

export function NoCollections({ onCreate, className }: NoCollectionsProps) {
  return (
    <EmptyState
      icon={Bookmark}
      title="No collections"
      description="Create collections to organize your favorite designs."
      action={onCreate ? { label: "Create collection", onClick: onCreate } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Downloads
// =============================================================================

interface NoDownloadsProps {
  onBrowse?: () => void;
  className?: string;
}

export function NoDownloads({ onBrowse, className }: NoDownloadsProps) {
  return (
    <EmptyState
      icon={Download}
      title="No downloads yet"
      description="Your download history will appear here."
      action={onBrowse ? { label: "Browse designs", onClick: onBrowse } : undefined}
      className={className}
    />
  );
}

// =============================================================================
// No Items (generic)
// =============================================================================

interface NoItemsProps {
  itemName?: string;
  className?: string;
}

export function NoItems({ itemName = "items", className }: NoItemsProps) {
  return (
    <EmptyState
      icon={Package}
      title={`No ${itemName}`}
      description={`There are no ${itemName} to display.`}
      className={className}
    />
  );
}

// =============================================================================
// Empty Folder
// =============================================================================

interface EmptyFolderProps {
  folderName?: string;
  className?: string;
}

export function EmptyFolder({ folderName, className }: EmptyFolderProps) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="Empty folder"
      description={
        folderName
          ? `The folder "${folderName}" is empty.`
          : "This folder is empty."
      }
      className={className}
    />
  );
}

// =============================================================================
// Table Empty State
// =============================================================================

interface TableEmptyStateProps {
  colSpan: number;
  message?: string;
  className?: string;
}

export function TableEmptyState({
  colSpan,
  message = "No data available",
  className,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div
          className={cn(
            "flex flex-col items-center justify-center py-12 text-center",
            className
          )}
        >
          <Inbox className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{message}</p>
        </div>
      </td>
    </tr>
  );
}
