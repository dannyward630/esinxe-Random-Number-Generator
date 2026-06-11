"""Assign stable samples to jobs regardless of worker count or execution order."""

import esinxe

field = esinxe.Random(8675309)


def sample_for(job_id, sample_index):
    return field.float01("simulation", job_id, esinxe.u64(sample_index))


if __name__ == "__main__":
    jobs = ["north", "south", "east", "west"]
    for job in jobs:
        print(job, [sample_for(job, index) for index in range(3)])
