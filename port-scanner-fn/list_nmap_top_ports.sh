function list_nmap_top_ports() {

    proto=$1
    num_ports=$2
    usage="Usage: list_nmap_top_ports <UDP/TCP> <1-65535>"

    if ! [ $# -eq 2 ] ; then
        echo "$usage"
        return
    elif ! [[ "$proto" =~ ^(tcp|udp)$ ]] && ! [[ "$proto" =~ ^(TCP|UDP)$ ]] ; then
        echo "$usage"
        return
    elif ! [[ "$num_ports" -ge 1 && "$num_ports" -le 65535 ]] ; then
        echo "$usage"
        return
    else

        port_list=()

        if [[ "$proto" =~ ^(tcp|TCP)$ ]] ; then
            raw_ports=$(nmap -sT --top-ports "$num_ports" -v -oG - 2>/dev/null | grep TCP | cut -d ';' -f 2 | cut -d ')' -f 1 | tr ',' '\n')
        else
            raw_ports=$(nmap -sU --top-ports "$num_ports" -v -oG - 2>/dev/null | grep UDP | cut -d ';' -f 3 | cut -d ')' -f 1 | tr ',' '\n')
        fi

        for port in $raw_ports ; do
            if [[ "$port" =~ ^[0-9]+\-[0-9]+$ ]] ; then
                start_range=$(echo "$port" | cut -d '-' -f 1)
                end_range=$(echo "$port" | cut -d '-' -f 2)
                for ((p=start_range; p<=end_range; p++)); do
                    port_list+=("$p")
                done
            elif [[ "$port" =~ ^[0-9]+$ ]]; then
                port_list+=("$port")
            fi
        done

        IFS=','; echo "${port_list[*]}"
    fi
}

list_nmap_top_ports "$1" "$2"