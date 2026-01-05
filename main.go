package main

import (
	"fmt"
	"lasagna/storage"
	"log"
	"os"
	"sort"

	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Name:  "lt",
		Usage: "Lasagna Storage CLI",
		Commands: []*cli.Command{
			{
				Name:  "storage",
				Usage: "Manage storage",
				Subcommands: []*cli.Command{
					{
						Name:      "create",
						Usage:     "create <storage_name>",
						ArgsUsage: "<storage_name>",
						Action: func(c *cli.Context) error {
							name := c.Args().First()
							if name == "" {
								return fmt.Errorf("storage name is required")
							}
							if err := storage.Create(name); err != nil {
								return err
							}
							fmt.Printf("Storage '%s' created.\n", name)
							return nil
						},
					},
					{
						Name:      "add",
						Usage:     "add <wav_file>",
						ArgsUsage: "<wav_file>",
						// We assume storage name is passed? The prompt says `lt storage add <wav_file>`.
						// But where does it get storage name?
						// "lt storage create <storage_name>"
						// "lt storage add <wav_file>" -> implies "current" storage or explicit arg missing in prompt example?
						// Prompt: "lt storage add <wav_file>"
						// But "lt storage get <storage_name> <UUID> <wav_file>"
						// It's inconsistent. `lt storage describe <storage_name>`.
						// Assuming `lt storage add <storage_name> <wav_file>` is the intended usage or there's a default.
						// Given the other commands take storage_name, `add` likely should too.
						// I will implement as `add <storage_name> <wav_file>`.
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:  "parent",
								Usage: "Parent UUID",
							},
						},
						Action: func(c *cli.Context) error {
							if c.NArg() < 2 {
								return fmt.Errorf("usage: lt storage add <storage_name> <path_to_wav_or_dir> [--parent <uuid>]")
							}
							storageName := c.Args().Get(0)
							inputPath := c.Args().Get(1)
							parentUUID := c.String("parent")

							// Fallback: manually scan args for --parent if not found
							if parentUUID == "" {
								args := c.Args().Slice()
								for i := 0; i < len(args)-1; i++ {
									if args[i] == "--parent" {
										parentUUID = args[i+1]
										break
									}
								}
							}

							// Check if inputPath is directory or file
							fInfo, err := os.Stat(inputPath)
							if err != nil {
								return err
							}

							filesToAdd := []string{}

							if fInfo.IsDir() {
								// Read directory
								entries, err := os.ReadDir(inputPath)
								if err != nil {
									return err
								}
								// Collect .wav files
								for _, e := range entries {
									if !e.IsDir() && (len(e.Name()) > 4 && e.Name()[len(e.Name())-4:] == ".wav") {
										filesToAdd = append(filesToAdd, inputPath+"/"+e.Name())
									}
								}
							} else {
								// Single file
								filesToAdd = append(filesToAdd, inputPath)
							}

							if len(filesToAdd) == 0 {
								fmt.Println("No .wav files found to add.")
								return nil
							}

							sort.Strings(filesToAdd)

							// Add files
							for _, fPath := range filesToAdd {
								id, err := storage.Add(storageName, fPath, parentUUID)
								if err != nil {
									return fmt.Errorf("failed to add %s: %v", fPath, err)
								}
								fmt.Printf("%s\n", id)
							}
							return nil
						},
					},
					{
						Name:      "get",
						Usage:     "get <storage_name> <UUID> <wav_file>",
						ArgsUsage: "<storage_name> <UUID> <wav_file>",
						Action: func(c *cli.Context) error {
							if c.NArg() < 3 {
								return fmt.Errorf("usage: lt storage get <storage_name> <UUID> <wav_file>")
							}
							storageName := c.Args().Get(0)
							id := c.Args().Get(1)
							wavFile := c.Args().Get(2)

							if err := storage.Get(storageName, id, wavFile); err != nil {
								return err
							}
							fmt.Printf("File retrieved to %s\n", wavFile)
							return nil
						},
					},
					{
						Name:      "describe",
						Usage:     "describe <storage_name> [UUID]",
						ArgsUsage: "<storage_name> [UUID]",
						Flags: []cli.Flag{
							&cli.BoolFlag{
								Name:  "ancestry",
								Usage: "Show ancestry tree",
							},
						},
						Action: func(c *cli.Context) error {
							// Manual flag parsing for --ancestry
							uuid := ""
							showAncestry := c.Bool("ancestry")

							args := c.Args().Slice()
							cleanArgs := []string{}
							for _, a := range args {
								if a == "--ancestry" {
									showAncestry = true
								} else {
									cleanArgs = append(cleanArgs, a)
								}
							}

							if len(cleanArgs) < 1 {
								return fmt.Errorf("storage name is required")
							}

							name := cleanArgs[0]

							// Case 1: describe <storage_name>
							if len(cleanArgs) == 1 {
								count, err := storage.Describe(name)
								if err != nil {
									return err
								}
								fmt.Printf("Stored audio files: %d\n", count)
								return nil
							}

							// Case 2: describe <storage_name> <UUID>
							uuid = cleanArgs[1]

							// Helper to print details
							printDetails := func(id string, inputMeta *storage.Metadata, prefix string) {
								p := inputMeta.ParentUUID
								if p == "" {
									p = "None"
								}
								fmt.Printf("%sUUID: %s\n", prefix, id)
								fmt.Printf("%sLength: %d\n", prefix, inputMeta.Length)
								fmt.Printf("%sOffset: %d\n", prefix, inputMeta.Offset)
								fmt.Printf("%sParent: %s\n", prefix, p)
							}

							meta, err := storage.GetMetadata(name, uuid)
							if err != nil {
								return err
							}

							if !showAncestry {
								printDetails(uuid, meta, "")
								return nil
							}

							// Ancestry traversal
							currentUUID := uuid
							currentMeta := meta
							depth := 1
							for {
								p := currentMeta.ParentUUID
								if p == "" {
									p = "None" // Or just stop? Prompt says: "Show the tree of ancestry"
								}
								// Print concise info for tree? Prompt says: "in addition to length, offset and parent, it will show the tree"
								// Let's just print the Standard details for the requested item, then the tree?
								// "lt storage describe UUID --ancestry" -> "in addition to length, offset and parent, it will show the tree of ancestry"
								// So print the main item first (already done by variable checking? No wait, logic above splits).

								// Re-reading prompt: "in addition to length, offset and parent, it will show the tree of ancestry in terminal"
								// So: Print details of THE requested UUID. Then print the tree.

								// Let's refactor loop.
								if depth == 1 {
									printDetails(currentUUID, currentMeta, "")
									fmt.Println("--- Ancestry Tree ---")
								}

								fmt.Printf("%d. %s (Parent: %s)\n", depth, currentUUID, p)

								if currentMeta.ParentUUID == "" {
									break
								}
								currentUUID = currentMeta.ParentUUID
								currentMeta, err = storage.GetMetadata(name, currentUUID)
								if err != nil {
									fmt.Printf("Error fetching parent %s: %v\n", currentUUID, err)
									break
								}
								depth++
							}

							return nil
						},
					},
					{
						Name:      "list",
						Usage:     "list <storage_name>",
						ArgsUsage: "<storage_name>",
						Action: func(c *cli.Context) error {
							name := c.Args().First()
							if name == "" {
								return fmt.Errorf("storage name is required")
							}
							uuids, err := storage.List(name)
							if err != nil {
								return err
							}
							for _, id := range uuids {
								fmt.Println(id)
							}
							return nil
						},
					},
				},
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
