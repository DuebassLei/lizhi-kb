use zeroize::{Zeroize, Zeroizing};

/// In-memory vault session. DEK is zeroized on lock/drop.
#[derive(Default)]
pub enum VaultSession {
    #[default]
    Locked,
    Unlocked(Zeroizing<[u8; 32]>),
}

impl VaultSession {
    pub fn is_locked(&self) -> bool {
        matches!(self, VaultSession::Locked)
    }

    pub fn unlock(&mut self, dek: [u8; 32]) {
        self.lock();
        *self = VaultSession::Unlocked(Zeroizing::new(dek));
    }

    pub fn lock(&mut self) {
        if let VaultSession::Unlocked(ref mut dek) = self {
            dek.zeroize();
        }
        *self = VaultSession::Locked;
    }

    pub fn dek(&self) -> Option<&[u8; 32]> {
        match self {
            VaultSession::Locked => None,
            VaultSession::Unlocked(dek) => Some(&**dek),
        }
    }
}

impl Drop for VaultSession {
    fn drop(&mut self) {
        // Zeroize only — do not call lock(), which assigns Locked and re-enters drop.
        if let VaultSession::Unlocked(ref mut dek) = self {
            dek.zeroize();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_zeroizes_dek() {
        let mut session = VaultSession::default();
        session.unlock([0xAB; 32]);
        assert!(!session.is_locked());
        session.lock();
        assert!(session.is_locked());
        assert!(session.dek().is_none());
    }
}
