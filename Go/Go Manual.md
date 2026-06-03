# Go Manual

Dependencies: Go 1.22 or newer.

```go
package main

import (
    "fmt"
    "github.com/dannyward630/esinxe/esinxe"
)

func main() {
    rng := esinxe.New(12345)
    fmt.Println(rng.Next())
    fmt.Println(rng.NextRawAt(1000))
}
```

Run tests with:

```sh
cd Go
go test ./...
```
