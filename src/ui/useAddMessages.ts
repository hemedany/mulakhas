import { useRef, useState, type DragEvent } from 'react'
import { useEngine, useOwnKeys } from '@/app/engine-hooks'

/**
 * Everything that adds Messages to the Thread: the file picker, drag and drop, and Text
 * messages. Whatever is added stays in the Thread; without a Groq key the key sheet opens,
 * and if the device cannot store the files the problem is reported, not swallowed.
 */
export function useAddMessages({ onNeedKey }: { onNeedKey: () => void }) {
  const { thread } = useEngine()
  const { groq } = useOwnKeys()
  const picker = useRef<HTMLInputElement>(null)
  const [storageFailed, setStorageFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [newTextId, setNewTextId] = useState<string | null>(null)

  const addFiles = async (files: File[]) => {
    const media = files.filter(f => /^(audio|video)\//.test(f.type) || /\.(opus|oga|ogg|m4a|aac|mp3|wav|flac|mp4|mov|webm|3gp|mkv)$/i.test(f.name))
    if (!media.length) return
    try {
      setStorageFailed(false)
      await thread.addFiles(media)
    } catch {
      setStorageFailed(true)
      return
    }
    if (!groq) onNeedKey()
  }

  const addText = async (at?: number) => {
    const id = await thread.addText(at ?? thread.get().messages.length)
    setNewTextId(id)
    if (!groq) onNeedKey()
    return id
  }

  // Desktop drag and drop onto the whole page. Counting enter/leave pairs avoids flicker over children.
  const depth = useRef(0)
  const dropZone = {
    onDragEnter: (e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) { depth.current++; setDragging(true) } },
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() },
    onDragLeave: () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false) },
    onDrop: (e: DragEvent) => { e.preventDefault(); depth.current = 0; setDragging(false); void addFiles([...e.dataTransfer.files]) },
  }

  return {
    picker,
    choose: () => picker.current?.click(),
    onPicked: (list: FileList | null) => void addFiles([...(list ?? [])]),
    addText,
    newTextId,
    setNewTextId,
    dropZone,
    dragging,
    storageFailed,
  }
}
