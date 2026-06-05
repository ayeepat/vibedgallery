import { supabase } from '@/lib/supabaseClient'
import { validateImageConstraints } from '@/lib/imageConstraints'

// Basic image safety checks. The pure type/size/dimension rules live in
// imageConstraints.js (unit-tested); this wrapper measures dimensions in the
// browser and feeds them in.
export async function checkImageSafety(file) {
  let width
  let height
  if (file.type?.startsWith('image/')) {
    const dimensions = await getImageDimensions(file)
    width = dimensions.width
    height = dimensions.height
  }

  const errors = validateImageConstraints({
    type: file.type,
    size: file.size,
    width,
    height,
  })

  return {
    safe: errors.length === 0,
    errors,
  }
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image. Please check the file and try again.'))
    }
    img.src = url
  })
}

// Uploads `file` to the app-images bucket and returns
// { publicUrl, storagePath } so callers can delete the object later if a
// downstream check (e.g. server-side moderation) rejects it.
export async function uploadImage(file, userId, folder = 'thumbnails') {
  const ext = file.name.split('.').pop()
  const filename = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('app-images')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Upload error:', error)
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('app-images')
    .getPublicUrl(filename)

  return { publicUrl: urlData.publicUrl, storagePath: filename }
}

// Remove an object from the app-images bucket. Best-effort: failures are
// logged but not thrown — the caller is usually already on an error path.
export async function deleteImage(storagePath) {
  if (!storagePath) return
  try {
    const { error } = await supabase.storage
      .from('app-images')
      .remove([storagePath])
    if (error) console.warn('deleteImage failed:', error.message)
  } catch (err) {
    console.warn('deleteImage threw:', err)
  }
}