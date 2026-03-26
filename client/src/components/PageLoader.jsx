import React from 'react'

export default function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="relative">
         {/* Minimal professional outer ring */}
         <div className="w-10 h-10 border-2 border-slate-100 rounded-full" />
         {/* High-contrast active spinner */}
         <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-slate-900 rounded-full animate-spin" />
      </div>
    </div>
  )
}
