import { Construction } from 'lucide-react'

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 p-8 rounded-2xl bg-slate-800 border border-slate-700 max-w-sm">
        <div className="flex justify-center">
          <div className="p-3 rounded-xl bg-slate-700 border border-slate-600">
            <Construction className="w-7 h-7 text-teal-400" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <p className="text-sm text-slate-400">
          This feature is under active development and will be available in a future release.
        </p>
      </div>
    </div>
  )
}
