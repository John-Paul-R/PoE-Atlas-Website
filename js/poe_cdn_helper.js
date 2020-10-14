class PoECDN {
    /**
     * @param {number} defaultScale 
     * @param {number} defaultLeague 
     * @param {number} defaultTier 
     */
    constructor (defaultScale, defaultLeague, defaultTier) {
        this.defaultScale = defaultScale;
        this.defaultLeague = defaultLeague;
        this.defaultTier = defaultTier;
        this.baseNormalLink = "https://web.poecdn.com/image/Art/2DItems/Maps/Atlas2Maps/New/"
        this.baseUniqueLink = "https://web.poecdn.com/gen/image/"
    
    }

    /**
     * 
     * @param {Object} nodeData 
     * @param {number} [scale=0] 
     * @param {number} [league=0] 
     * @param {number} [tier=0] 
     * 
     * @returns {string}
     */
    buildNodeImageLink(nodeData, scale=0, league=0, tier=0) {
        const cdnScale = "scale=";
        const cdnLeague = "mn="
        const cdnTier = "mt="
        let out;
        if (nodeData.IsUniqueMapArea) {
            out =   this.baseUniqueLink + nodeData.cdnKey
                    +'?'+cdnScale + scale;
        } else {
            // Handle Vaal Temple
            if (nodeData.RowID === 8) {
                tier=0;
            }
            out =   this.baseNormalLink + nodeData.cdnKey
                    +'?'+cdnScale + scale
                    +'&'+cdnLeague + league
                    +'&'+cdnTier + tier;
        }
        return out;
    }

    /**
     * 
     * @param {string} link 
     * @returns {string} 
     */
    keyFromLink(link) {
        let out = link.includes(this.baseNormalLink) ? link.replace(this.baseNormalLink, '') : link.replace(this.baseUniqueLink, '');
        return out.replace(/\?scale.*/g, "");
    }
}

var poecdnHelper = new PoECDN(0, 0, 0);
    

    // let nodeImagesDict;

        // .addResource("data/Maps155-DICT-heist-1.json", [(resJson) => {
        //     nodeImagesDict = resJson;//JSON.parse(nodeImagesDictRequest.responseText);
        // }])
        // .addCompletionFunc(() => {
        //     console.log(nodeImagesDict);
        //     let erroredNames = []
        //     console.groupCollapsed("CDN Key Error Log");
            
        //     for (let i=0; i<nodeData.length; i++) {
        //         let entry = nodeData[i];
        //         try {
        //             entry.cdnKey = poecdnHelper.keyFromLink(nodeImagesDict[toPoEDBName(entry.Name, entry.IsUniqueMapArea)].Icon);
        //             // console.log(`${entry.Name}: ${entry.cdnKey}`);
    
        //         } catch (error) {
        //             erroredNames.push(entry.Name)
        //             console.log(`Error finding matching icon for ${entry.Name}.`)
        //             console.error(error);
        //         }
        //     }
        //     console.groupEnd();
        //     if (erroredNames.length > 0) {
        //         console.warn(`Failed to load ${erroredNames.length} node names/cdnKeys.`)
        //     } else {
        //         console.info("All node names & cndKeys loaded successfully! (in theory)")
        //     }    

        // })
