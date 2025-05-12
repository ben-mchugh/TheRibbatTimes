import { format, formatDistanceToNow } from 'date-fns';

/**
 * Safely formats a date string for display
 * @param dateString ISO date string or any valid date string
 * @param formatStr Optional format string for date-fns
 * @returns Formatted date string or fallback text if date is invalid
 */
export function formatDate(dateString?: string, formatStr: string = 'MMMM d, yyyy'): string {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return format(date, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown date';
  }
}

/**
 * Safely formats a date as a relative time (e.g., "5 minutes ago")
 * @param dateString ISO date string or any valid date string
 * @returns Relative time string or fallback text if date is invalid
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Recently';
  
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Recently';
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Recently';
  }
}