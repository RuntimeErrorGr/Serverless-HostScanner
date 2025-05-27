"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface BulkDeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  itemType: string
  itemCount: number
}

export function BulkDeleteDialog({ isOpen, onClose, onConfirm, itemType, itemCount }: BulkDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center space-x-2">
            <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>
              You are about to permanently delete <span className="font-semibold text-red-600">{itemCount}</span>{" "}
              {itemType.toLowerCase()}
              {itemCount !== 1 ? "s" : ""}.
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All associated data will be permanently removed.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Delete {itemCount} {itemType.toLowerCase()}
            {itemCount !== 1 ? "s" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
