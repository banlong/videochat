package main
import (
	"net/http"
	"strings"
	"os"
	"bufio"
	"log"
	"html/template"
)

func main() {

	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/css/", serveResource)
	http.HandleFunc("/js/", serveResource)
	//TODO: start the Signal Server
	http.ListenAndServe(":8000", nil)
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("home handler: ", r.URL)
	w.Header().Add("Content Type", "text/html")
	var tc *template.Template
	tc = template.Must(template.ParseFiles("index.html"))
	tc.Execute(w, nil)
}

func serveResource(w http.ResponseWriter, req *http.Request) {
	path := "." + req.URL.Path
	var contentType string
	if strings.HasSuffix(path, ".css") {
		contentType = "text/css"
	} else if strings.HasSuffix(path, ".png") {
		contentType = "image/png"
	} else {
		contentType = "text/plain"
	}

	f, err := os.Open(path)

	if err == nil {
		defer f.Close()
		w.Header().Add("Content Type", contentType)

		br := bufio.NewReader(f)
		br.WriteTo(w)
	} else {
		w.WriteHeader(404)
	}
}

