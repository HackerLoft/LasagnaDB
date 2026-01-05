.PHONY: build test clean

build:
	go build -o lt main.go

test: build
	chmod +x integration_test.sh
	./integration_test.sh

clean:
	rm -f lt *.ls *.ls.idx *.wav
	rm -rf tmp
