/**
 * Copies the provided text to the clipboard.
 * @param text - The text to be copied to the clipboard.
 * @returns A promise that resolves when the text has been copied successfully, or rejects if the copy fails.
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
      await navigator.clipboard.writeText(text);
      console.log('Text copied to clipboard:', text);
  } catch (err) {
      console.error('Failed to copy text to clipboard:', err);
      throw new Error('Failed to copy text to clipboard');
  }
};
