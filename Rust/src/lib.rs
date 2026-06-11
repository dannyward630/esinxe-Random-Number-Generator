pub const GOLDEN_GAMMA: u64 = 0x9E37_79B9_7F4A_7C15;
pub const MAX_INT_VALUE: u64 = 1_000_000_000_000_000_000;
pub const FNV_OFFSET_BASIS: u64 = 0xCBF2_9CE4_8422_2325;
pub const FNV_PRIME: u64 = 0x0000_0100_0000_01B3;
const V1_PREFIX: &[u8] = b"esinxe-v1\0";

#[derive(Clone, Copy, Debug)]
pub enum Key<'a> {
    I64(i64),
    U64(u64),
    Str(&'a str),
    Bytes(&'a [u8]),
}

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

#[inline]
fn fnv_update(mut hash: u64, bytes: &[u8]) -> u64 {
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

fn encode_length(hash: u64, length: usize) -> u64 {
    fnv_update(hash, &(length as u64).to_le_bytes())
}

fn hash_key(mut hash: u64, key: Key<'_>) -> u64 {
    match key {
        Key::I64(value) => {
            hash = fnv_update(hash, &[0x01]);
            fnv_update(hash, &(value as u64).to_le_bytes())
        }
        Key::U64(value) => {
            hash = fnv_update(hash, &[0x02]);
            fnv_update(hash, &value.to_le_bytes())
        }
        Key::Str(value) => {
            hash = fnv_update(hash, &[0x03]);
            hash = encode_length(hash, value.len());
            fnv_update(hash, value.as_bytes())
        }
        Key::Bytes(value) => {
            hash = fnv_update(hash, &[0x04]);
            hash = encode_length(hash, value.len());
            fnv_update(hash, value)
        }
    }
}

fn hash_domain(mut hash: u64, domain: &str) -> u64 {
    hash = fnv_update(hash, &[0xF0]);
    hash = encode_length(hash, domain.len());
    fnv_update(hash, domain.as_bytes())
}

fn keyed_raw(seed: u64, keys: &[Key<'_>], domain: Option<&str>) -> u64 {
    let mut hash = fnv_update(FNV_OFFSET_BASIS, V1_PREFIX);
    hash = fnv_update(hash, &seed.to_le_bytes());
    if let Some(value) = domain {
        hash = hash_domain(hash, value);
    }
    for key in keys {
        hash = hash_key(hash, *key);
    }
    mix64(hash)
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

    pub fn raw(&self, keys: &[Key<'_>]) -> u64 {
        keyed_raw(self.seed, keys, None)
    }

    pub fn int(&self, max_value: u64, keys: &[Key<'_>]) -> Result<u64, &'static str> {
        if max_value == 0 {
            return Err("max_value must be positive");
        }
        Ok(bounded(self.raw(keys), max_value))
    }

    pub fn range(
        &self,
        min_value: i64,
        max_value: i64,
        keys: &[Key<'_>],
    ) -> Result<i64, &'static str> {
        let width = i128::from(max_value) - i128::from(min_value);
        if width <= 0 || width > i128::from(u64::MAX) + 1 {
            return Err("range width must be in [1, 2^64]");
        }
        let offset = if width == i128::from(u64::MAX) + 1 {
            self.raw(keys)
        } else {
            bounded(self.raw(keys), width as u64)
        };
        Ok((i128::from(min_value) + i128::from(offset)) as i64)
    }

    pub fn float01(&self, keys: &[Key<'_>]) -> f64 {
        ((self.raw(keys) >> 11) as f64) / ((1_u64 << 53) as f64)
    }

    pub fn at_2d(&self, x: i64, y: i64, namespace: Option<&str>) -> u64 {
        let mut keys = vec![Key::I64(x), Key::I64(y)];
        if let Some(value) = namespace {
            keys.push(Key::Str(value));
        }
        keyed_raw(self.seed, &keys, Some("at2d"))
    }

    pub fn at_3d(&self, x: i64, y: i64, z: i64, namespace: Option<&str>) -> u64 {
        let mut keys = vec![Key::I64(x), Key::I64(y), Key::I64(z)];
        if let Some(value) = namespace {
            keys.push(Key::Str(value));
        }
        keyed_raw(self.seed, &keys, Some("at3d"))
    }

    pub fn chance_ratio(
        &self,
        numerator: u64,
        denominator: u64,
        keys: &[Key<'_>],
    ) -> Result<bool, &'static str> {
        if denominator == 0 {
            return Err("denominator must be positive");
        }
        if numerator >= denominator {
            return Ok(true);
        }
        Ok(bounded(self.raw(keys), denominator) < numerator)
    }

    pub fn choose<'a, T>(&self, items: &'a [T], keys: &[Key<'_>]) -> Option<&'a T> {
        if items.is_empty() {
            return None;
        }
        items.get(bounded(self.raw(keys), items.len() as u64) as usize)
    }

    pub fn shuffle<T: Clone>(&self, items: &[T], keys: &[Key<'_>]) -> Vec<T> {
        let mut values = items.to_vec();
        for index in (1..values.len()).rev() {
            let mut iteration_keys = keys.to_vec();
            iteration_keys.push(Key::U64(index as u64));
            let picked = bounded(
                keyed_raw(self.seed, &iteration_keys, Some("shuffle")),
                (index + 1) as u64,
            ) as usize;
            values.swap(index, picked);
        }
        values
    }

    pub fn weighted_choice<'a, T>(
        &self,
        items: &'a [T],
        weights: &[u64],
        keys: &[Key<'_>],
    ) -> Option<&'a T> {
        if items.is_empty() || items.len() != weights.len() {
            return None;
        }
        let total = weights
            .iter()
            .try_fold(0_u64, |sum, weight| sum.checked_add(*weight))?;
        if total == 0 {
            return None;
        }
        let target = bounded(self.raw(keys), total);
        let mut running = 0_u64;
        for (item, weight) in items.iter().zip(weights) {
            running += *weight;
            if target < running {
                return Some(item);
            }
        }
        None
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
    use super::{Key, Random};

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

    #[test]
    fn keyed_api_matches_v1_vectors_without_advancing() {
        let vectors = include_str!("../../tests/vectors-v1.json");
        assert!(vectors.contains("\"algorithm\": \"esinxe-v1\""));

        let mut rng = Random::new(12345);
        let key = [
            Key::I64(-1),
            Key::U64(u64::MAX),
            Key::Str("snowman \u{2603}"),
            Key::Bytes(&[0, 1, 255]),
        ];
        let expected_next = rng.next_raw_at(0);

        assert_eq!(rng.raw(&[]), 1011603955933495094);
        assert_eq!(rng.raw(&[Key::I64(1)]), 8375777008512348728);
        assert_eq!(rng.raw(&[Key::U64(1)]), 3036097878260785046);
        assert_eq!(rng.raw(&key), 12374036822843504307);
        assert_eq!(rng.raw(&[Key::Str("")]), 16674029134230574194);
        assert_eq!(rng.raw(&[Key::Bytes(&[])]), 1966942287052825313);
        assert_eq!(rng.int(100, &key), Ok(7));
        assert_eq!(rng.range(-500, 500, &key), Ok(-193));
        assert_eq!(rng.raw(&key) >> 11, 6042010167404054);
        assert_eq!(
            rng.at_2d(-17, 42, Some("terrain/\u{96ea}")),
            7642296274646480051
        );
        assert_eq!(rng.at_2d(-17, 42, None), 12949904772278389126);
        assert_eq!(
            rng.at_3d(-17, 42, i64::MIN, Some("caves")),
            3469495484090590785
        );
        assert_eq!(rng.chance_ratio(7, 23, &key), Ok(false));
        assert_eq!(
            rng.choose(&["forest", "desert", "tundra", "ocean"], &key),
            Some(&"ocean")
        );
        assert_eq!(
            rng.shuffle(&["forest", "desert", "tundra", "ocean"], &key),
            ["forest", "ocean", "tundra", "desert"]
        );
        assert_eq!(
            rng.weighted_choice(&["common", "rare", "legendary"], &[80, 18, 2], &key),
            Some(&"common")
        );
        assert_eq!(rng.next_raw(), expected_next);
    }

    #[test]
    fn keyed_api_rejects_invalid_inputs() {
        let rng = Random::new(0);
        assert!(rng.int(0, &[]).is_err());
        assert!(rng.range(5, 5, &[]).is_err());
        assert!(rng.chance_ratio(1, 0, &[]).is_err());
        assert!(rng.choose::<u8>(&[], &[]).is_none());
        assert!(rng.weighted_choice(&["x"], &[0], &[]).is_none());
        assert!(rng.weighted_choice(&["x"], &[u64::MAX, 1], &[]).is_none());
    }
}
