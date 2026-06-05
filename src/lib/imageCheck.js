import { supabase } from '@/lib/supabaseClient'

// Basic image safety checks
export async function checkImageSafety(file) {
  const errors = []

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    errors.push('File must be JPG, PNG, WebP or GIF')
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    errors.push('File must be under 5MB')
  }

  // Check dimensions
  if (file.type.startsWith('image/')) {
    const dimensions = await getImageDimensions(file)
    if (dimensions.width < 200 || dimensions.height < 100) {
      errors.push('Image must be at least 200x100 pixels')
    }
    if (dimensions.width > 6000 || dimensions.height > 6000) {
      errors.push('Image is too large. Max 6000x6000 pixels')
    }
  }

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