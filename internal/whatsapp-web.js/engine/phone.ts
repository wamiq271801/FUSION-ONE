/**
 * Indian phone-number normalization.
 *
 * Accepts various Indian mobile number formats and normalizes to the
 * WhatsApp chat ID format: 91XXXXXXXXXX@c.us
 */

export function normalizeIndianChatId(input: string): string {
    const digits = input.replace(/\D/g, '');

    let phone: string;
    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
        phone = '91' + digits;
    } else if (
        digits.length === 12 &&
        digits.startsWith('91') &&
        /^91[6-9]\d{9}$/.test(digits)
    ) {
        phone = digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
        const stripped = digits.slice(1);
        if (/^[6-9]\d{9}$/.test(stripped)) {
            phone = '91' + stripped;
        } else {
            throw new Error(
                `Invalid Indian mobile number: "${input}" — domestic part must start with 6-9.`,
            );
        }
    } else {
        throw new Error(
            `Invalid Indian mobile number: "${input}". ` +
                `Expected 10 digits starting with 6-9, or 91 + 10 digits. ` +
                `Got ${digits.length} digits.`,
        );
    }

    return `${phone}@c.us`;
}
