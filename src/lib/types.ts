export interface UserProfile {
    email: string;
    name: string;
    given_name: string;
    family_name?: string;
    picture: string;
}

export interface EmailData {
    to: string;
    subject: string;
    body: string; // HTML allowed
    from?: { name: string; email: string };
    attachments?: File[];
}

export interface SendLog {
    status: 'success' | 'error' | 'info';
    msg: string;
    timestamp?: Date;
}

export interface SendProgress {
    sent: number;
    total: number;
    failed: number;
}
