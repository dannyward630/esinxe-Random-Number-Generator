pub const GOLDEN_GAMMA: u64 = 0x9E37_79B9_7F4A_7C15;
pub const MAX_INT_VALUE: u64 = 1_000_000_000_000_000_000;

#[inline]
pub fn mix64(mut value: u64) -> u64 {
    value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    value ^ (value >> 31)
}

#[inline]
fn bounded(mut value: u64, max_value: u64) -> u64 {
    if max_value == 0 {
        return 0;
    }
    let threshold = max_value.wrapping_neg() % max_value;
    let mut nonce = 0_u64;
    while value < threshold {
        nonce = nonce.wrapping_add(1);
        value = mix64(value.wrapping_add(nonce.wrapping_mul(GOLDEN_GAMMA)));
    }
    value % max_value
}

#[derive(Clone, Debug)]
pub struct Random {
    seed: u64,
    index: u64,
    key: u64,
}

impl Random {
    pub fn new(seed: u64) -> Self {
        Self {
            seed,
            index: 0,
            key: seed,
        }
    }

    pub fn set_seed(&mut self, seed: u64) {
        self.seed = seed;
        self.index = 0;
        self.key = seed;
    }

    pub fn next_raw_at(&self, offset: u64) -> u64 {
        mix64(self.seed.wrapping_add(offset.wrapping_mul(GOLDEN_GAMMA)))
    }

    pub fn next_raw(&mut self) -> u64 {
        let value = mix64(self.key);
        self.key = self.key.wrapping_add(GOLDEN_GAMMA);
        self.index = self.index.wrapping_add(1);
        value
    }

    pub fn next_at(&self, offset: u64) -> u64 {
        bounded(self.next_raw_at(offset), MAX_INT_VALUE)
    }

    pub fn next(&mut self) -> u64 {
        let value = bounded(mix64(self.key), MAX_INT_VALUE);
        self.key = self.key.wrapping_add(GOLDEN_GAMMA);
        self.index = self.index.wrapping_add(1);
        value
    }

    pub fn next_max_at(&self, offset: u64, max_value: u64) -> u64 {
        bounded(self.next_raw_at(offset), max_value)
    }

    pub fn next_max(&mut self, max_value: u64) -> u64 {
        let value = bounded(mix64(self.key), max_value);
        self.key = self.key.wrapping_add(GOLDEN_GAMMA);
        self.index = self.index.wrapping_add(1);
        value
    }

    pub fn next_min_max_at(&self, offset: u64, min_value: u64, max_value: u64) -> Option<u64> {
        if max_value <= min_value {
            return None;
        }
        Some(min_value + self.next_max_at(offset, max_value - min_value))
    }

    pub fn next_min_max(&mut self, min_value: u64, max_value: u64) -> Option<u64> {
        let value = if max_value <= min_value {
            None
        } else {
            Some(min_value + bounded(mix64(self.key), max_value - min_value))
        };
        self.key = self.key.wrapping_add(GOLDEN_GAMMA);
        self.index = self.index.wrapping_add(1);
        value
    }
}

#[cfg(test)]
mod tests {
    use super::Random;

    const FIRST_VALUES: [u64; 5] = [
        540659726606785873,
        454886589211414944,
        778200017661327597,
        205171434679333405,
        248800117070709450,
    ];
    const FIRST_RAW_VALUES: [u64; 5] = [
        17540659726606785873,
        2454886589211414944,
        3778200017661327597,
        2205171434679333405,
        3248800117070709450,
    ];

    #[test]
    fn matches_shared_vectors() {
        let mut rng = Random::new(12345);
        let values: Vec<u64> = (0..5).map(|_| rng.next()).collect();
        assert_eq!(values, FIRST_VALUES);

        rng.set_seed(12345);
        let raw: Vec<u64> = (0..5).map(|i| rng.next_raw_at(i)).collect();
        assert_eq!(raw, FIRST_RAW_VALUES);
    }

    #[test]
    fn bounded_and_ranged_vectors_match() {
        let mut bounded = Random::new(12345);
        let values: Vec<u64> = (0..5).map(|_| bounded.next_max(100)).collect();
        assert_eq!(values, [73, 44, 97, 5, 50]);

        let mut ranged = Random::new(12345);
        let values: Vec<u64> = (0..5)
            .map(|_| ranged.next_min_max(50, 100).unwrap())
            .collect();
        assert_eq!(values, [73, 94, 97, 55, 50]);
    }
}
